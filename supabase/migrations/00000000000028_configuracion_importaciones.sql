BEGIN;

-- ============================================================
-- Migration 28: Configuración de organización, códigos de
--               producto, stock histórico, importación de datos
-- ============================================================
-- 1.  Configuración de organización
-- 2.  Código interno para productos (SKU-XXXXXX) transaccional
-- 3.  Stock histórico (inmutable, con fecha_snapshot_dia UTC)
-- 4.  Importaciones de datos
-- 5.  Errores de importación por fila
-- 6.  Ventas históricas
-- 7.  Storage bucket para archivos grandes
-- 8.  RLS policies
-- 9.  RPC: generar_snapshot_stock (deriva org_id del auth)
-- 10. RPC: procesar_stock_inicial (transaccional, estrategias)
-- 11. Función: validar_dominio_correo
-- 12. Función: generar_codigo_producto (con advisory lock)
-- ============================================================

-- ============================================================
-- 1. Configuración de organización
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion_organizacion (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL UNIQUE REFERENCES organizaciones(id) ON DELETE CASCADE,

  -- Generales
  idioma                    text NOT NULL DEFAULT 'es',
  zona_horaria              text NOT NULL DEFAULT 'America/Lima',
  formato_fecha             text NOT NULL DEFAULT 'DD/MM/YYYY',
  formato_hora              text NOT NULL DEFAULT '24h',
  simbolo_moneda            text NOT NULL DEFAULT 'S/',
  posicion_moneda           text NOT NULL DEFAULT 'antes',         -- 'antes' | 'despues'
  nombre_comercial          text,
  direccion_fiscal          text,
  telefono_contacto         text,
  email_contacto            text,
  dominio_web               text,

  -- Stock y alertas
  permite_stock_negativo    boolean NOT NULL DEFAULT false,
  control_stock_minimo      boolean NOT NULL DEFAULT true,
  alerta_vencimiento_dias   int NOT NULL DEFAULT 30,

  -- Notificaciones
  notificaciones_email      boolean NOT NULL DEFAULT true,
  notificaciones_sistema    boolean NOT NULL DEFAULT true,

  -- Pipeline ML (solo flags, sin datos ficticios de ejecución)
  pipeline_activo           boolean NOT NULL DEFAULT false,
  snapshot_automatico       boolean NOT NULL DEFAULT false,
  dias_historial_prediccion int NOT NULL DEFAULT 365,
  algoritmo_prediccion      text NOT NULL DEFAULT 'sarima_xgboost',
  umbral_mape_maximo        numeric(5,2) NOT NULL DEFAULT 30.00,
  frecuencia_reentrenamiento_dias int NOT NULL DEFAULT 90,

  -- Datos de ejecución: SOLO fechas reales, nunca ficticias
  datos_desde               date,
  datos_hasta               date,

  -- Dominios permitidos para importación de usuarios
  dominios_correo_permitidos text[] NOT NULL DEFAULT '{}',

  created_at                timestamptz NOT NULL DEFAULT now(),
  modified_at               timestamptz,
  modified_by               uuid REFERENCES usuarios(id)
);

COMMENT ON TABLE configuracion_organizacion IS 'Configuración general por organización. Campos de infraestructura NO editables desde frontend.';
COMMENT ON COLUMN configuracion_organizacion.dominios_correo_permitidos IS 'Lista de dominios de correo aceptados para importación de usuarios. Vacío = sin restricción.';
COMMENT ON COLUMN configuracion_organizacion.pipeline_activo IS 'Solo lectura desde frontend. No mostrar datos ficticios de última ejecución.';

-- Trigger: crear configuración por defecto al crear una organización
CREATE OR REPLACE FUNCTION public.crear_config_default_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO configuracion_organizacion (org_id)
  VALUES (NEW.id)
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_config_default_org ON organizaciones;
CREATE TRIGGER trg_crear_config_default_org
  AFTER INSERT ON organizaciones
  FOR EACH ROW EXECUTE FUNCTION public.crear_config_default_org();

-- Backfill: crear configuración para organizaciones existentes
INSERT INTO configuracion_organizacion (org_id)
SELECT id FROM organizaciones
ON CONFLICT (org_id) DO NOTHING;

-- ============================================================
-- 2. Código interno para productos (SKU-XXXXXX)
-- ============================================================
-- 2a. Agregar columna codigo_interno (nullable, UNIQUE por org)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_interno text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_codigo_org
  ON productos(org_id, codigo_interno)
  WHERE codigo_interno IS NOT NULL;

-- 2b. Función transaccional para generar SKU (con advisory lock por org)
CREATE OR REPLACE FUNCTION public.generar_codigo_producto()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_codigo    text;
BEGIN
  v_org_id := obtener_org_usuario();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la organización del usuario';
  END IF;

  -- Lock transaccional por org_id: evita colisiones en concurrencia
  PERFORM pg_advisory_xact_lock(
    hashtext('gen_codigo_producto_' || v_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(codigo_interno, 5) AS integer)),
    0
  ) + 1 INTO v_next_num
  FROM productos
  WHERE org_id = v_org_id
    AND codigo_interno ~ '^SKU-\d{6}$';

  v_codigo := 'SKU-' || LPAD(v_next_num::text, 6, '0');

  RETURN v_codigo;
END;
$$;

-- 2c. Backfill: generar SKU para productos existentes sin código
DO $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_row       record;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
    FROM productos
    WHERE codigo_interno IS NULL
  LOOP
    SELECT COALESCE(
      MAX(CAST(substr(codigo_interno, 5) AS integer)), 0
    ) INTO v_next_num
    FROM productos
    WHERE org_id = v_org_id
      AND codigo_interno IS NOT NULL
      AND codigo_interno ~ '^SKU-\d{6}$';

    FOR v_row IN
      SELECT id
      FROM productos
      WHERE org_id = v_org_id AND codigo_interno IS NULL
      ORDER BY created_at
    LOOP
      v_next_num := v_next_num + 1;
      UPDATE productos
      SET codigo_interno = 'SKU-' || LPAD(v_next_num::text, 6, '0')
      WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- 3. Stock histórico (inmutable desde frontend)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_historico (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizaciones(id),
  producto_id        uuid NOT NULL REFERENCES productos(id),
  ubicacion_tipo     tipo_ubicacion NOT NULL,
  ubicacion_id       uuid REFERENCES boticas(id),
  cantidad_disponible int NOT NULL,
  stock_minimo       int NOT NULL,
  stock_maximo       int,
  fecha_snapshot_dia date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stock_historico IS 'Snapshot diario del stock. Inmutable: solo INSERT vía RPC, sin UPDATE/DELETE desde frontend.';
COMMENT ON COLUMN stock_historico.fecha_snapshot_dia IS 'Fecha del snapshot en UTC. Usada en la restricción única para evitar duplicados diarios.';

-- Índice único: evita duplicados del mismo producto+ubicación+fecha
-- Se usa COALESCE para manejar ubicacion_id NULL (droguería central)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_historico_unique
  ON stock_historico (
    org_id,
    producto_id,
    ubicacion_tipo,
    COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fecha_snapshot_dia
  );

CREATE INDEX IF NOT EXISTS idx_stock_historico_org ON stock_historico(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_historico_producto ON stock_historico(producto_id);
CREATE INDEX IF NOT EXISTS idx_stock_historico_fecha ON stock_historico(fecha_snapshot_dia DESC);

-- ============================================================
-- 4. Importaciones de datos
-- ============================================================
CREATE TABLE IF NOT EXISTS importaciones_datos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizaciones(id),
  usuario_id            uuid NOT NULL REFERENCES usuarios(id),
  tipo_importacion      text NOT NULL CHECK (tipo_importacion IN (
                            'boticas', 'productos', 'proveedores',
                            'usuarios', 'proveedor_producto',
                            'stock_inicial', 'ventas_historicas'
                          )),
  estado                text NOT NULL DEFAULT 'validando' CHECK (estado IN (
                            'validando', 'listo_para_importar',
                            'procesando', 'completada',
                            'completada_con_errores', 'fallida'
                          )),
  nombre_archivo_original text,
  ruta_archivo          text,       -- storage path: org_id/<importacion_id>/<filename>
  mime_type             text,
  tamano_bytes          bigint,
  resumen_jsonb         jsonb,      -- { total: N, validos: N, invalidos: N, warnings: N }
  detalle_error         text,       -- resumen legible del error (errores detallados en importaciones_datos_errores)
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz
);

COMMENT ON TABLE importaciones_datos IS 'Registro de importaciones de datos. Dos flujos: validar → importar.';
COMMENT ON COLUMN importaciones_datos.ruta_archivo IS 'Ruta en storage: org_id/<importacion_id>/<nombre_archivo>';
COMMENT ON COLUMN importaciones_datos.resumen_jsonb IS 'Resumen de validación: {total, validos, invalidos, warnings}';
COMMENT ON COLUMN importaciones_datos.detalle_error IS 'Resumen textual del error. Errores por fila en importaciones_datos_errores.';

CREATE INDEX IF NOT EXISTS idx_importaciones_org ON importaciones_datos(org_id);
CREATE INDEX IF NOT EXISTS idx_importaciones_tipo ON importaciones_datos(tipo_importacion);
CREATE INDEX IF NOT EXISTS idx_importaciones_estado ON importaciones_datos(estado);
CREATE INDEX IF NOT EXISTS idx_importaciones_created_at ON importaciones_datos(created_at DESC);

-- ============================================================
-- 5. Errores de importación por fila
-- ============================================================
CREATE TABLE IF NOT EXISTS importaciones_datos_errores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id  uuid NOT NULL REFERENCES importaciones_datos(id) ON DELETE CASCADE,
  fila            int NOT NULL,            -- número de fila en el archivo (1-indexado, sin header)
  columna         text,                    -- nombre de la columna con error (puede ser NULL si es error general de fila)
  valor           text,                    -- valor original que causó el error
  mensaje_error   text NOT NULL,           -- descripción del error
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE importaciones_datos_errores IS 'Errores detallados por fila durante la validación/importación.';

CREATE INDEX IF NOT EXISTS idx_import_errores_importacion ON importaciones_datos_errores(importacion_id);

-- ============================================================
-- 6. Ventas históricas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_historicas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizaciones(id),
  botica_id         uuid NOT NULL REFERENCES boticas(id),
  producto_id       uuid NOT NULL REFERENCES productos(id),
  fecha_venta       date NOT NULL,
  cantidad          int NOT NULL CHECK (cantidad > 0),
  precio_unitario   numeric(10,2),
  -- Relación opcional con importación (sin FK para evitar pérdida de datos si se elimina el registro de importación)
  importacion_id    uuid,
  -- Clave de idempotencia: evita duplicados en re-importaciones
  clave_idempotencia text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_historicas IS 'Datos históricos de ventas importados. No genera movimientos de inventario.';
COMMENT ON COLUMN ventas_historicas.importacion_id IS 'ID de la importación que originó este registro. Sin FK para evitar pérdida de datos.';
COMMENT ON COLUMN ventas_historicas.clave_idempotencia IS 'Hash único por fila importada para garantizar idempotencia.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_historicas_idempotencia
  ON ventas_historicas(org_id, clave_idempotencia);

CREATE INDEX IF NOT EXISTS idx_ventas_historicas_org ON ventas_historicas(org_id);
CREATE INDEX IF NOT EXISTS idx_ventas_historicas_botica ON ventas_historicas(botica_id);
CREATE INDEX IF NOT EXISTS idx_ventas_historicas_producto ON ventas_historicas(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_historicas_fecha ON ventas_historicas(fecha_venta DESC);

-- ============================================================
-- 7. Storage bucket para archivos de importación
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'importaciones-datos',
  'importaciones-datos',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. RLS — Habilitar en tablas nuevas
-- ============================================================
ALTER TABLE configuracion_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE importaciones_datos ENABLE ROW LEVEL SECURITY;
ALTER TABLE importaciones_datos_errores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_historicas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8a. RLS — configuracion_organizacion
-- ============================================================
-- admin_central y super_admin: FULL access
-- operador_drogueria y visor_botica: SELECT solamente
DROP POLICY IF EXISTS "admin_full_access" ON configuracion_organizacion;
DROP POLICY IF EXISTS "operador_select" ON configuracion_organizacion;
DROP POLICY IF EXISTS "visor_select" ON configuracion_organizacion;

CREATE POLICY "admin_full_access" ON configuracion_organizacion FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

CREATE POLICY "operador_select" ON configuracion_organizacion FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

CREATE POLICY "visor_select" ON configuracion_organizacion FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- 8b. RLS — stock_historico (inmutable: solo SELECT policies)
-- ============================================================
DROP POLICY IF EXISTS "admin_select_stock_historico" ON stock_historico;
DROP POLICY IF EXISTS "operador_select_stock_historico" ON stock_historico;
DROP POLICY IF EXISTS "visor_select_stock_historico" ON stock_historico;

-- admin_central y super_admin: SELECT todo el org
CREATE POLICY "admin_select_stock_historico" ON stock_historico FOR SELECT
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

-- operador_drogueria: SELECT todo el org
CREATE POLICY "operador_select_stock_historico" ON stock_historico FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- visor_botica: SELECT solo su botica
CREATE POLICY "visor_select_stock_historico" ON stock_historico FOR SELECT
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND org_id = obtener_org_usuario()
    AND ubicacion_id = obtener_botica_usuario()
  );

-- Sin policies de INSERT/UPDATE/DELETE: solo escritura vía SECURITY DEFINER RPC

-- ============================================================
-- 8c. RLS — importaciones_datos
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON importaciones_datos;
DROP POLICY IF EXISTS "operador_select" ON importaciones_datos;
DROP POLICY IF EXISTS "visor_select" ON importaciones_datos;

CREATE POLICY "admin_full_access" ON importaciones_datos FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

CREATE POLICY "operador_select" ON importaciones_datos FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

CREATE POLICY "visor_select" ON importaciones_datos FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- 8d. RLS — importaciones_datos_errores
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON importaciones_datos_errores;
DROP POLICY IF EXISTS "operador_select" ON importaciones_datos_errores;
DROP POLICY IF EXISTS "visor_select" ON importaciones_datos_errores;

CREATE POLICY "admin_full_access" ON importaciones_datos_errores FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central'
      AND EXISTS (SELECT 1 FROM importaciones_datos i
        WHERE i.id = importacion_id AND i.org_id = obtener_org_usuario()))
  );

CREATE POLICY "operador_select" ON importaciones_datos_errores FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM importaciones_datos i
      WHERE i.id = importacion_id AND i.org_id = obtener_org_usuario()));

CREATE POLICY "visor_select" ON importaciones_datos_errores FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM importaciones_datos i
      WHERE i.id = importacion_id AND i.org_id = obtener_org_usuario()));

-- ============================================================
-- 8e. RLS — ventas_historicas
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ventas_historicas;
DROP POLICY IF EXISTS "operador_select" ON ventas_historicas;
DROP POLICY IF EXISTS "visor_select" ON ventas_historicas;

CREATE POLICY "admin_full_access" ON ventas_historicas FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

CREATE POLICY "operador_select" ON ventas_historicas FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- visor_botica: solo registros de su propia botica
CREATE POLICY "visor_select" ON ventas_historicas FOR SELECT
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND org_id = obtener_org_usuario()
    AND botica_id = obtener_botica_usuario()
  );

-- ============================================================
-- 8f. RLS — storage.objects (importaciones-datos bucket)
-- ============================================================
-- Los archivos se almacenan en: importaciones-datos/<org_id>/<importacion_id>/<filename>

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='admin_lectura_storage') THEN
    CREATE POLICY "admin_lectura_storage" ON storage.objects FOR SELECT
      USING (
        bucket_id = 'importaciones-datos'
        AND (
          obtener_rol_usuario() = 'super_admin'
          OR (
            obtener_rol_usuario() = 'admin_central'
            AND (storage.foldername(name))[1] = obtener_org_usuario()::text
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='operador_lectura_storage') THEN
    CREATE POLICY "operador_lectura_storage" ON storage.objects FOR SELECT
      USING (
        bucket_id = 'importaciones-datos'
        AND obtener_rol_usuario() = 'operador_drogueria'
        AND (storage.foldername(name))[1] = obtener_org_usuario()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='visor_lectura_storage') THEN
    CREATE POLICY "visor_lectura_storage" ON storage.objects FOR SELECT
      USING (
        bucket_id = 'importaciones-datos'
        AND obtener_rol_usuario() = 'visor_botica'
        AND (storage.foldername(name))[1] = obtener_org_usuario()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='admin_escritura_storage') THEN
    CREATE POLICY "admin_escritura_storage" ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'importaciones-datos'
        AND (
          obtener_rol_usuario() = 'super_admin'
          OR (
            obtener_rol_usuario() = 'admin_central'
            AND (storage.foldername(name))[1] = obtener_org_usuario()::text
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='admin_actualizar_storage') THEN
    CREATE POLICY "admin_actualizar_storage" ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'importaciones-datos'
        AND (
          obtener_rol_usuario() = 'super_admin'
          OR (
            obtener_rol_usuario() = 'admin_central'
            AND (storage.foldername(name))[1] = obtener_org_usuario()::text
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='admin_eliminar_storage') THEN
    CREATE POLICY "admin_eliminar_storage" ON storage.objects FOR DELETE
      USING (
        bucket_id = 'importaciones-datos'
        AND (
          obtener_rol_usuario() = 'super_admin'
          OR (
            obtener_rol_usuario() = 'admin_central'
            AND (storage.foldername(name))[1] = obtener_org_usuario()::text
          )
        )
      );
  END IF;
END $$;

-- Nota: Las policies de storage ya fueron creadas condicionalmente en los bloques DO anteriores

-- ============================================================
-- 9. RPC: generar_snapshot_stock
--    Toma el org_id del auth, NO del llamante.
--    Solo para uso autenticado (no service role).
-- ============================================================
CREATE OR REPLACE FUNCTION public.generar_snapshot_stock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_count  int;
BEGIN
  -- Derivar org_id del JWT autenticado, nunca del parámetro
  v_org_id := obtener_org_usuario();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la organización. Usuario no autenticado o sin org_id.';
  END IF;

  INSERT INTO stock_historico (
    org_id, producto_id, ubicacion_tipo, ubicacion_id,
    cantidad_disponible, stock_minimo, stock_maximo,
    fecha_snapshot_dia
  )
  SELECT
    su.org_id,
    su.producto_id,
    su.ubicacion_tipo,
    su.ubicacion_id,
    su.cantidad_disponible,
    su.stock_minimo,
    su.stock_maximo,
    (now() AT TIME ZONE 'UTC')::date
  FROM stock_ubicaciones su
  WHERE su.org_id = v_org_id
  ON CONFLICT (
    org_id,
    producto_id,
    ubicacion_tipo,
    COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fecha_snapshot_dia
  ) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Registrar auditoría
  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id,
    nivel, detalle, metadata_jsonb
  )
  VALUES (
    v_org_id,
    auth.uid(),
    'GENERAR_SNAPSHOT_STOCK',
    'stock_historico',
    NULL,
    'info',
    format('Snapshot diario generado: %s registro(s)', v_count),
    jsonb_build_object('snapshots_creados', v_count)
  );

  RETURN jsonb_build_object('exito', true, 'snapshots_creados', v_count);
END;
$$;

COMMENT ON FUNCTION public.generar_snapshot_stock() IS 'Genera snapshot diario de stock para la organización del usuario autenticado. No permite p_org_id=NULL para procesar todos los tenants.';

-- ============================================================
-- 10. RPC: procesar_stock_inicial
--     Transaccional, maneja estrategias reemplazar/sumar/saltar.
--     Nunca borra historial.
-- ============================================================
CREATE OR REPLACE FUNCTION public.procesar_stock_inicial(
  p_items     jsonb,    -- array de objetos validados
  p_org_id    uuid,
  p_usuario_id uuid,
  p_estrategia text DEFAULT 'reemplazar'  -- 'reemplazar' | 'sumar' | 'saltar'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        record;
  v_stock_id    uuid;
  v_lote_id     uuid;
  v_insertados  int := 0;
  v_actualizados int := 0;
  v_omitidos    int := 0;
  v_old_stock   int;
  v_diff        int;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('exito', false, 'error', 'No hay items para procesar');
  END IF;

  IF p_estrategia NOT IN ('reemplazar', 'sumar', 'saltar') THEN
    RETURN jsonb_build_object('exito', false, 'error', 'Estrategia inválida. Use: reemplazar, sumar, saltar');
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      producto_id      uuid,
      ubicacion_tipo   text,
      ubicacion_id     uuid,
      cantidad         int,
      numero_lote      text,
      fecha_vencimiento date,
      proveedor_id     uuid
    )
  LOOP
    -- Buscar o crear registro de stock_ubicaciones
    SELECT id, cantidad_disponible INTO v_stock_id, v_old_stock
    FROM stock_ubicaciones
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = v_item.ubicacion_tipo::tipo_ubicacion
      AND (ubicacion_id IS NOT DISTINCT FROM v_item.ubicacion_id)
    FOR UPDATE;  -- lock fila para evitar condición de carrera

    IF NOT FOUND THEN
      -- Crear nuevo registro de stock
      INSERT INTO stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, updated_at
      )
      VALUES (
        p_org_id, v_item.producto_id, v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        v_item.cantidad, 0, NULL,
        0, 0, now()
      )
      RETURNING id INTO v_stock_id;

      v_insertados := v_insertados + 1;
      v_old_stock := 0;
      v_diff := v_item.cantidad;
    ELSE
      -- Estrategias para stock existente
      IF p_estrategia = 'reemplazar' THEN
        v_diff := v_item.cantidad - v_old_stock;

        UPDATE stock_ubicaciones
        SET cantidad_disponible = GREATEST(v_item.cantidad, 0),
            updated_at = now()
        WHERE id = v_stock_id;

        v_actualizados := v_actualizados + 1;
      ELSIF p_estrategia = 'sumar' THEN
        UPDATE stock_ubicaciones
        SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
            updated_at = now()
        WHERE id = v_stock_id;

        v_diff := v_item.cantidad;
        v_actualizados := v_actualizados + 1;
      ELSE  -- 'saltar'
        v_omitidos := v_omitidos + 1;
        CONTINUE;  -- no modificar nada
      END IF;
    END IF;

    -- Solo crear lote y movimiento si cantidad > 0
    IF v_item.cantidad > 0 AND v_item.numero_lote IS NOT NULL AND v_item.fecha_vencimiento IS NOT NULL THEN
      -- Buscar lote existente o crear uno nuevo
      INSERT INTO lotes (
        producto_id, ubicacion_tipo, ubicacion_id,
        numero_lote, fecha_vencimiento, cantidad,
        proveedor_id, org_id
      )
      VALUES (
        v_item.producto_id, v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad,
        v_item.proveedor_id, p_org_id
      )
      ON CONFLICT (producto_id, numero_lote, ubicacion_tipo,
        COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET
        cantidad = lotes.cantidad + EXCLUDED.cantidad,
        fecha_vencimiento = LEAST(lotes.fecha_vencimiento, EXCLUDED.fecha_vencimiento)
      RETURNING id INTO v_lote_id;

      -- Registrar movimiento de ajuste (no se borra historial)
      INSERT INTO movimientos_inventario (
        producto_id, lote_id, ubicacion_tipo, ubicacion_id,
        tipo_movimiento, cantidad, motivo, usuario_id, org_id
      )
      VALUES (
        v_item.producto_id, v_lote_id, v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        'ajuste', v_item.cantidad, 'Importación de stock inicial',
        p_usuario_id, p_org_id
      );
    END IF;
  END LOOP;

  -- Registrar auditoría
  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id,
    nivel, detalle, metadata_jsonb
  )
  VALUES (
    p_org_id, p_usuario_id, 'IMPORTAR_STOCK_INICIAL',
    'stock_ubicaciones', NULL, 'info',
    format(
      'Importación de stock inicial: %s insertados, %s actualizados, %s omitidos (estrategia: %s)',
      v_insertados, v_actualizados, v_omitidos, p_estrategia
    ),
    jsonb_build_object(
      'insertados', v_insertados,
      'actualizados', v_actualizados,
      'omitidos', v_omitidos,
      'estrategia', p_estrategia
    )
  );

  RETURN jsonb_build_object(
    'exito', true,
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'omitidos', v_omitidos
  );
END;
$$;

COMMENT ON FUNCTION public.procesar_stock_inicial IS 'Procesa importación de stock inicial de forma transaccional. Estrategias: reemplazar, sumar, saltar. Nunca borra historial.';

-- ============================================================
-- 11. Función: validar_dominio_correo
--     Compara exactamente la parte después de @ contra
--     la lista de dominios permitidos de la organización.
--     Lista vacía = sin restricción.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validar_dominio_correo(
  p_email  text,
  p_org_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dominio       text;
  v_dominios      text[];
  v_dominio_val   text;
BEGIN
  -- Extraer dominio exacto (parte después del @)
  v_dominio := split_part(p_email, '@', 2);

  IF v_dominio = '' OR v_dominio IS NULL THEN
    RETURN false;
  END IF;

  -- Obtener lista de dominios permitidos
  SELECT dominios_correo_permitidos INTO v_dominios
  FROM configuracion_organizacion
  WHERE org_id = p_org_id;

  -- Lista vacía = sin restricción
  IF v_dominios IS NULL OR array_length(v_dominios, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Validación exacta (no substring tricks)
  FOREACH v_dominio_val IN ARRAY v_dominios
  LOOP
    IF v_dominio = v_dominio_val THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.validar_dominio_correo IS 'Valida que el dominio del correo esté en la lista de dominios permitidos de la organización.';

-- ============================================================
-- 12. Seteo de huso horario UTC por sesión (se ejecuta en cada conexión)
-- ============================================================
-- Nota: Esto es un recordatorio. La ejecución real se hace desde
-- la configuración de Supabase (o el pooler) y desde cada Edge Function.
-- No se puede fijar con ALTER DATABASE en una migración estándar.
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE current_database() SET timezone = ''UTC''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No se pudo cambiar timezone a nivel de base de datos. Se usará por sesión.';
END;
$$;

COMMIT;
