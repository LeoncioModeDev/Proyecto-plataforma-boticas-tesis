-- ============================================================
-- Migración inicial — botica-demand-ml
-- Esquema completo + RLS
-- ============================================================

BEGIN;

-- ============================================================
-- Extensiones
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF (SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'pg_net') <> 'net' THEN
      DROP EXTENSION pg_net CASCADE;
      DROP SCHEMA IF EXISTS net CASCADE;
      CREATE EXTENSION pg_net;
    END IF;
  ELSE
    DROP SCHEMA IF EXISTS net CASCADE;
    CREATE EXTENSION pg_net;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE tipo_ubicacion AS ENUM ('drogueria', 'botica');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste', 'merma', 'devolucion');
CREATE TYPE tipo_transferencia AS ENUM ('transferencia_central', 'redistribucion');
CREATE TYPE estado_transferencia AS ENUM ('creada', 'en_transito', 'recibida', 'cancelada');
CREATE TYPE tipo_identificacion AS ENUM ('ruc', 'nit', 'tax_id', 'vat', 'otro');
CREATE TYPE clasificacion_producto AS ENUM ('OTC', 'receta', 'generico');
CREATE TYPE estado_producto AS ENUM ('activo', 'inactivo', 'descontinuado');
CREATE TYPE tipo_alerta AS ENUM ('quiebre', 'sobrestock', 'vencimiento_proximo', 'prediccion');
CREATE TYPE tipo_origen_alerta AS ENUM ('regla', 'modelo');
CREATE TYPE urgencia_alerta AS ENUM ('alta', 'media', 'baja');
CREATE TYPE estado_modelo AS ENUM ('staging', 'production', 'archived');
CREATE TYPE estado_recomendacion AS ENUM ('pendiente', 'confirmada', 'rechazada', 'ejecutada');
CREATE TYPE estado_orden_compra AS ENUM ('pendiente', 'aprobada', 'rechazada', 'completada');
CREATE TYPE tendencia_drift AS ENUM ('estable', 'degradando', 'mejorando');
CREATE TYPE rol_usuario AS ENUM ('super_admin', 'admin_central', 'operador_drogueria', 'visor_botica');

-- ============================================================
-- Tabla: paises
-- ============================================================
CREATE TABLE IF NOT EXISTS paises (
  codigo char(2) PRIMARY KEY,
  nombre text NOT NULL
);

-- ============================================================
-- Tabla: ubigeos
-- ============================================================
CREATE TABLE IF NOT EXISTS ubigeos (
  codigo       char(6) PRIMARY KEY,
  distrito     text,
  provincia    text NOT NULL,
  departamento text NOT NULL
);

-- ============================================================
-- Tabla: organizaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS organizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  tipo_identificacion tipo_identificacion NOT NULL,
  numero_identificacion text NOT NULL,
  pais_origen     char(2) NOT NULL DEFAULT 'PE' REFERENCES paises(codigo),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_identificacion, numero_identificacion)
);

-- ============================================================
-- Tabla: monedas
-- ============================================================
CREATE TABLE IF NOT EXISTS monedas (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo   char(3) NOT NULL UNIQUE,
  nombre   text NOT NULL,
  simbolo  char(5) NOT NULL
);

-- ============================================================
-- Tabla: unidades_medida
-- ============================================================
CREATE TABLE IF NOT EXISTS unidades_medida (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL UNIQUE,
  simbolo text NOT NULL
);

-- ============================================================
-- Tabla: principios_activos
-- ============================================================
CREATE TABLE IF NOT EXISTS principios_activos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  codigo_atc  text
);
CREATE INDEX IF NOT EXISTS idx_principios_activos_nombre ON principios_activos(nombre);

-- ============================================================
-- Tabla: formas_farmaceuticas
-- ============================================================
CREATE TABLE IF NOT EXISTS formas_farmaceuticas (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE
);

-- NOTA: tabla presentaciones eliminada — presentacion es texto libre en productos.

-- ============================================================
-- Tabla: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organizaciones(id),
  nombre        text NOT NULL,
  email         text NOT NULL UNIQUE,
  rol           rol_usuario NOT NULL DEFAULT 'visor_botica',
  botica_id     uuid,
  avatar        text,
  telefono      text,
  activo        boolean NOT NULL DEFAULT true,
  ultimo_acceso timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sincronizar_usuario()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, org_id, nombre, email, rol, botica_id, avatar, telefono, activo, created_at)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'org_id', '')::uuid,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombre', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'rol', ''), 'visor_botica')::rol_usuario,
    NULLIF(NEW.raw_user_meta_data->>'botica_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'avatar', ''),
    NULLIF(NEW.raw_user_meta_data->>'telefono', ''),
    true,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id    = EXCLUDED.org_id,
    nombre    = EXCLUDED.nombre,
    email     = EXCLUDED.email,
    rol       = EXCLUDED.rol,
    botica_id = EXCLUDED.botica_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sincronizar_usuario: error al procesar %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_after_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_usuario();

-- ============================================================
-- Tabla: boticas
-- ============================================================
CREATE TABLE IF NOT EXISTS boticas (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id   uuid NOT NULL REFERENCES organizaciones(id),
  nombre   text NOT NULL,
  tipo     tipo_ubicacion NOT NULL,
  ubigeo   char(6) NOT NULL REFERENCES ubigeos(codigo),
  direccion text,
  telefono text,
  activa   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boticas_org ON boticas(org_id);

-- ============================================================
-- Tabla: productos
-- Nota: codigo_interno, codigo_barras eliminados.
--       presentacion es texto libre (sin FK a presentaciones).
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizaciones(id),
  nombre_comercial      text NOT NULL,
  forma_farmaceutica_id uuid REFERENCES formas_farmaceuticas(id),
  presentacion          text,
  clasificacion         clasificacion_producto NOT NULL,
  estado                estado_producto NOT NULL DEFAULT 'activo',
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz,
  modified_by           uuid REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_productos_org ON productos(org_id);
CREATE INDEX IF NOT EXISTS idx_productos_buscador ON productos USING gin (nombre_comercial gin_trgm_ops);

-- ============================================================
-- Tabla: producto_principio_activo
-- ============================================================
CREATE TABLE IF NOT EXISTS producto_principio_activo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id         uuid NOT NULL REFERENCES productos(id),
  principio_activo_id uuid NOT NULL REFERENCES principios_activos(id),
  concentracion       numeric(10,2) NOT NULL,
  unidad_medida_id    uuid REFERENCES unidades_medida(id),
  UNIQUE (producto_id, principio_activo_id)
);
CREATE INDEX IF NOT EXISTS idx_producto_pa_producto ON producto_principio_activo(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_pa_pa ON producto_principio_activo(principio_activo_id);

-- ============================================================
-- Tabla: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizaciones(id),
  razon_social        text NOT NULL,
  tipo_identificacion tipo_identificacion NOT NULL,
  numero_identificacion text NOT NULL,
  pais_origen         char(2) NOT NULL DEFAULT 'PE' REFERENCES paises(codigo),
  moneda_id           uuid REFERENCES monedas(id),
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_identificacion, numero_identificacion)
);
CREATE INDEX IF NOT EXISTS idx_proveedores_org ON proveedores(org_id);

-- ============================================================
-- Tabla: contactos_proveedor
-- ============================================================
CREATE TABLE IF NOT EXISTS contactos_proveedor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id  uuid NOT NULL REFERENCES proveedores(id),
  nombre        text NOT NULL,
  telefono      text,
  correo        text,
  direccion     text,
  ubigeo        char(6) REFERENCES ubigeos(codigo),
  principal     boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_contactos_proveedor ON contactos_proveedor(proveedor_id);

-- ============================================================
-- Tabla: proveedor_producto
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedor_producto (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          uuid NOT NULL REFERENCES proveedores(id),
  producto_id           uuid NOT NULL REFERENCES productos(id),
  lead_time_especifico  int NOT NULL,
  precio_compra         numeric(10,2) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, producto_id)
);
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_proveedor ON proveedor_producto(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_producto ON proveedor_producto(producto_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_created_at ON proveedor_producto(created_at);

-- ============================================================
-- Tabla: precios
-- ============================================================
CREATE TABLE IF NOT EXISTS precios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid NOT NULL REFERENCES productos(id),
  botica_id     uuid REFERENCES boticas(id),
  precio_venta  numeric(10,2) NOT NULL,
  precio_costo  numeric(10,2) NOT NULL,
  vigente_desde timestamptz NOT NULL,
  vigente_hasta timestamptz
);
CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios(producto_id);

-- ============================================================
-- Tabla: stock_ubicaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_ubicaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id        uuid NOT NULL REFERENCES productos(id),
  ubicacion_tipo     tipo_ubicacion NOT NULL,
  ubicacion_id       uuid REFERENCES boticas(id),
  cantidad_disponible int NOT NULL DEFAULT 0,
  stock_minimo       int NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ubicaciones_unique
  ON stock_ubicaciones (producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX IF NOT EXISTS idx_stock_producto ON stock_ubicaciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_stock_ubicacion ON stock_ubicaciones(ubicacion_tipo, ubicacion_id);

-- ============================================================
-- Tabla: lotes
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  ubicacion_tipo   tipo_ubicacion NOT NULL,
  ubicacion_id     uuid REFERENCES boticas(id),
  numero_lote      text NOT NULL,
  fecha_vencimiento date NOT NULL,
  cantidad         int NOT NULL,
  proveedor_id     uuid REFERENCES proveedores(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_unique
  ON lotes (producto_id, numero_lote, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);

-- ============================================================
-- Tabla: movimientos_inventario
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  lote_id          uuid REFERENCES lotes(id),
  ubicacion_tipo   tipo_ubicacion NOT NULL,
  ubicacion_id     uuid REFERENCES boticas(id),
  tipo_movimiento  tipo_movimiento NOT NULL,
  cantidad         int NOT NULL,
  motivo           text NOT NULL,
  usuario_id       uuid NOT NULL,
  transferencia_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(created_at);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_inventario(tipo_movimiento);

-- ============================================================
-- Tabla: transferencias
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_transferencia tipo_transferencia NOT NULL,
  origen_tipo       tipo_ubicacion NOT NULL,
  origen_id         uuid REFERENCES boticas(id),
  destino_tipo      tipo_ubicacion NOT NULL DEFAULT 'botica',
  destino_id        uuid NOT NULL REFERENCES boticas(id),
  estado            estado_transferencia NOT NULL DEFAULT 'creada',
  creado_por        uuid NOT NULL,
  fecha_despacho    timestamptz,
  fecha_recepcion   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON transferencias(estado);

-- ============================================================
-- Tabla: transferencias_items
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES transferencias(id),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  lote_id          uuid REFERENCES lotes(id),
  cantidad         int NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transferencias_items_transferencia ON transferencias_items(transferencia_id);

-- ============================================================
-- Tabla: ordenes_compra
-- ============================================================
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          uuid NOT NULL REFERENCES proveedores(id),
  creado_por            uuid NOT NULL,
  estado                estado_orden_compra NOT NULL DEFAULT 'pendiente',
  fecha_estimada_entrega date,
  observaciones         text,
  aprobado_por          uuid,
  fecha_aprobacion      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oc_proveedor ON ordenes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_oc_estado ON ordenes_compra(estado);

-- ============================================================
-- Tabla: ordenes_compra_items
-- ============================================================
CREATE TABLE IF NOT EXISTS ordenes_compra_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id uuid NOT NULL REFERENCES ordenes_compra(id),
  producto_id     uuid NOT NULL REFERENCES productos(id),
  cantidad        int NOT NULL,
  precio_unitario numeric(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oc_items_orden ON ordenes_compra_items(orden_compra_id);

-- ============================================================
-- Tablas ML
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_ml (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version             text NOT NULL UNIQUE,
  algoritmo           text NOT NULL,
  hash                text NOT NULL,
  fecha_entrenamiento timestamptz NOT NULL,
  fecha_promocion     timestamptz,
  mae                 float NOT NULL,
  rmse                float NOT NULL,
  mape                float NOT NULL,
  psi_baseline_jsonb  jsonb NOT NULL,
  datos_desde         date NOT NULL,
  datos_hasta         date NOT NULL,
  status              estado_modelo NOT NULL DEFAULT 'staging',
  activo              boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_modelos_ml_production ON modelos_ml (status) WHERE status = 'production';

CREATE TABLE IF NOT EXISTS predicciones_ml (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id       uuid NOT NULL REFERENCES productos(id),
  botica_id         uuid NOT NULL REFERENCES boticas(id),
  periodo_inicio    date NOT NULL,
  periodo_fin       date NOT NULL,
  cantidad_predicha float NOT NULL,
  intervalo_inf     float NOT NULL,
  intervaloSup     float NOT NULL,
  confianza         float NOT NULL,
  modelo_version_id uuid NOT NULL REFERENCES modelos_ml(id),
  generado_en       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE predicciones_ml REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_predicciones_producto_botica ON predicciones_ml(producto_id, botica_id);

CREATE TABLE IF NOT EXISTS inferencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id       uuid NOT NULL REFERENCES productos(id),
  botica_id         uuid NOT NULL REFERENCES boticas(id),
  modelo_version_id uuid NOT NULL REFERENCES modelos_ml(id),
  fecha_pred        date NOT NULL,
  valor_pred        float NOT NULL,
  features_jsonb    jsonb NOT NULL,
  valor_real        float,
  error_absoluto    float,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_inferencias_modelo_fecha ON inferencias(modelo_version_id, fecha_pred);
CREATE INDEX IF NOT EXISTS idx_inferencias_producto_botica ON inferencias(producto_id, botica_id, fecha_pred);

CREATE TABLE IF NOT EXISTS drift_metricas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_version_id         uuid NOT NULL REFERENCES modelos_ml(id),
  fecha_calculo             timestamptz NOT NULL DEFAULT now(),
  ventana_dias              int NOT NULL DEFAULT 28,
  psi_features              jsonb NOT NULL,
  psi_max                   float NOT NULL,
  mape_rolling              float NOT NULL,
  mape_baseline             float NOT NULL,
  ratio_mape                float NOT NULL,
  tendencia                 tendencia_drift NOT NULL,
  requiere_retraining       boolean NOT NULL,
  reentrenamiento_disparado boolean NOT NULL DEFAULT false
);
ALTER TABLE drift_metricas REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_drift_modelo_fecha ON drift_metricas(modelo_version_id, fecha_calculo);

CREATE TABLE IF NOT EXISTS alertas_ml (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        tipo_alerta NOT NULL,
  tipo_origen tipo_origen_alerta NOT NULL,
  producto_id uuid NOT NULL REFERENCES productos(id),
  botica_id   uuid NOT NULL REFERENCES boticas(id),
  urgencia    urgencia_alerta NOT NULL,
  resuelta    boolean NOT NULL DEFAULT false,
  generado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alertas_ml REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_alertas_botica ON alertas_ml(botica_id);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta ON alertas_ml(resuelta);

CREATE TABLE IF NOT EXISTS recomendaciones_ml (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id        uuid NOT NULL REFERENCES productos(id),
  botica_destino_id  uuid NOT NULL REFERENCES boticas(id),
  botica_origen_id   uuid REFERENCES boticas(id),
  tipo_recomendacion text NOT NULL,
  cantidad_sugerida  int NOT NULL,
  motivo             text NOT NULL,
  confianza_modelo   float NOT NULL,
  estado             estado_recomendacion NOT NULL DEFAULT 'pendiente',
  transferencia_id   uuid REFERENCES transferencias(id),
  confirmado_por     uuid,
  confirmado_en      timestamptz,
  generado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_estado ON recomendaciones_ml(estado);

-- ============================================================
-- Trigger: actualizar_stock
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimiento IN ('entrada', 'devolucion') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  ELSIF NEW.tipo_movimiento IN ('salida', 'merma') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_actualizar_stock
AFTER INSERT ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION actualizar_stock();

COMMIT;

-- ============================================================
-- RLS: Row-Level Security
-- ============================================================

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.obtener_rol_usuario()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'rol',
    current_setting('request.jwt.claims', true)::jsonb
      -> 'user_metadata'
      ->> 'rol',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.obtener_org_usuario()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'org_id')::uuid,
    (SELECT org_id FROM public.usuarios WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.obtener_botica_usuario()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'botica_id')::uuid,
    (SELECT botica_id FROM public.usuarios WHERE id = auth.uid())
  );
$$;

-- ============================================================
-- Habilitar RLS en todas las tablas
-- ============================================================
ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubigeos ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE monedas ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE principios_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_farmaceuticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE boticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_principio_activo ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE inferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE recomendaciones_ml ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas — Tablas globales de referencia (catálogos)
-- ============================================================

CREATE POLICY "admin_full_access" ON paises FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON paises FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access" ON ubigeos FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON ubigeos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access" ON monedas FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON monedas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access" ON unidades_medida FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON unidades_medida FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access" ON principios_activos FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON principios_activos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access" ON formas_farmaceuticas FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "lectura_autenticados" ON formas_farmaceuticas FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- organizaciones
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON organizaciones;
DROP POLICY IF EXISTS "operador_select_org" ON organizaciones;
DROP POLICY IF EXISTS "visor_select_org" ON organizaciones;
CREATE POLICY "admin_full_access" ON organizaciones FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_select_org" ON organizaciones FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND id = obtener_org_usuario());
CREATE POLICY "visor_select_org" ON organizaciones FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = obtener_org_usuario());

-- ============================================================
-- usuarios
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON usuarios;
DROP POLICY IF EXISTS "operador_usuarios" ON usuarios;
DROP POLICY IF EXISTS "visor_select_self" ON usuarios;
DROP POLICY IF EXISTS "self_update" ON usuarios;
CREATE POLICY "admin_full_access" ON usuarios FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_usuarios" ON usuarios FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_self" ON usuarios FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = auth.uid());
CREATE POLICY "self_update" ON usuarios FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- boticas
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON boticas;
DROP POLICY IF EXISTS "operador_boticas" ON boticas;
DROP POLICY IF EXISTS "visor_select_botica" ON boticas;
CREATE POLICY "admin_full_access" ON boticas FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_boticas" ON boticas FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_botica" ON boticas FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = obtener_botica_usuario());

-- ============================================================
-- productos
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON productos;
DROP POLICY IF EXISTS "operador_productos" ON productos;
DROP POLICY IF EXISTS "visor_select_productos" ON productos;
CREATE POLICY "admin_full_access" ON productos FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_productos" ON productos FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_productos" ON productos FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- producto_principio_activo
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON producto_principio_activo;
DROP POLICY IF EXISTS "operador_producto_pa" ON producto_principio_activo;
DROP POLICY IF EXISTS "visor_select_producto_pa" ON producto_principio_activo;
CREATE POLICY "admin_full_access" ON producto_principio_activo FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_producto_pa" ON producto_principio_activo FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_producto_pa" ON producto_principio_activo FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario()));

-- ============================================================
-- proveedores
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON proveedores;
DROP POLICY IF EXISTS "operador_proveedores" ON proveedores;
DROP POLICY IF EXISTS "visor_select_proveedores" ON proveedores;
CREATE POLICY "admin_full_access" ON proveedores FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_proveedores" ON proveedores FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_proveedores" ON proveedores FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- contactos_proveedor
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON contactos_proveedor;
DROP POLICY IF EXISTS "operador_contactos_prov" ON contactos_proveedor;
DROP POLICY IF EXISTS "visor_select_contactos_prov" ON contactos_proveedor;
CREATE POLICY "admin_full_access" ON contactos_proveedor FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_contactos_prov" ON contactos_proveedor FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM proveedores WHERE id = proveedor_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_contactos_prov" ON contactos_proveedor FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM proveedores WHERE id = proveedor_id AND org_id = obtener_org_usuario()));

-- ============================================================
-- proveedor_producto
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON proveedor_producto;
DROP POLICY IF EXISTS "operador_prov_producto" ON proveedor_producto;
DROP POLICY IF EXISTS "visor_select_prov_producto" ON proveedor_producto;
CREATE POLICY "admin_full_access" ON proveedor_producto FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_prov_producto" ON proveedor_producto FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND (EXISTS (SELECT 1 FROM proveedores WHERE id = proveedor_id AND org_id = obtener_org_usuario())
      OR EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario())));
CREATE POLICY "visor_select_prov_producto" ON proveedor_producto FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario()));

-- ============================================================
-- precios
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON precios;
DROP POLICY IF EXISTS "operador_precios" ON precios;
DROP POLICY IF EXISTS "visor_select_precios" ON precios;
CREATE POLICY "admin_full_access" ON precios FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_precios" ON precios FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_precios" ON precios FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (botica_id = obtener_botica_usuario() OR botica_id IS NULL));

-- ============================================================
-- stock_ubicaciones
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON stock_ubicaciones;
DROP POLICY IF EXISTS "operador_stock" ON stock_ubicaciones;
DROP POLICY IF EXISTS "visor_select_stock" ON stock_ubicaciones;
CREATE POLICY "admin_full_access" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_stock" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_stock" ON stock_ubicaciones FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- lotes
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON lotes;
DROP POLICY IF EXISTS "operador_lotes" ON lotes;
DROP POLICY IF EXISTS "visor_select_lotes" ON lotes;
CREATE POLICY "admin_full_access" ON lotes FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_lotes" ON lotes FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_lotes" ON lotes FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- movimientos_inventario
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON movimientos_inventario;
DROP POLICY IF EXISTS "operador_movimientos" ON movimientos_inventario;
DROP POLICY IF EXISTS "visor_select_movimientos" ON movimientos_inventario;
CREATE POLICY "admin_full_access" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_movimientos" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_movimientos" ON movimientos_inventario FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- transferencias
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias;
DROP POLICY IF EXISTS "operador_transferencias" ON transferencias;
DROP POLICY IF EXISTS "visor_select_transferencias" ON transferencias;
CREATE POLICY "admin_full_access" ON transferencias FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_transferencias" ON transferencias FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND (EXISTS (SELECT 1 FROM boticas WHERE id = origen_id  AND org_id = obtener_org_usuario())
      OR EXISTS (SELECT 1 FROM boticas WHERE id = destino_id AND org_id = obtener_org_usuario())));
CREATE POLICY "visor_select_transferencias" ON transferencias FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (origen_id = obtener_botica_usuario() OR destino_id = obtener_botica_usuario()));

-- ============================================================
-- transferencias_items
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias_items;
DROP POLICY IF EXISTS "operador_transferencias_items" ON transferencias_items;
DROP POLICY IF EXISTS "visor_select_transferencias_items" ON transferencias_items;
CREATE POLICY "admin_full_access" ON transferencias_items FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_transferencias_items" ON transferencias_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM transferencias t
      WHERE t.id = transferencia_id
        AND (EXISTS (SELECT 1 FROM boticas WHERE id = t.origen_id  AND org_id = obtener_org_usuario())
          OR EXISTS (SELECT 1 FROM boticas WHERE id = t.destino_id AND org_id = obtener_org_usuario()))));
CREATE POLICY "visor_select_transferencias_items" ON transferencias_items FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM transferencias t
      WHERE t.id = transferencia_id
        AND (t.origen_id = obtener_botica_usuario() OR t.destino_id = obtener_botica_usuario())));

-- ============================================================
-- ordenes_compra
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ordenes_compra;
DROP POLICY IF EXISTS "operador_oc" ON ordenes_compra;
CREATE POLICY "admin_full_access" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_oc" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM proveedores WHERE id = proveedor_id AND org_id = obtener_org_usuario()));

-- ============================================================
-- ordenes_compra_items
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ordenes_compra_items;
DROP POLICY IF EXISTS "operador_oc_items" ON ordenes_compra_items;
CREATE POLICY "admin_full_access" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_oc_items" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM ordenes_compra oc
      JOIN proveedores p ON p.id = oc.proveedor_id
      WHERE oc.id = orden_compra_id AND p.org_id = obtener_org_usuario()));

-- ============================================================
-- modelos_ml
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON modelos_ml;
DROP POLICY IF EXISTS "operador_select_modelos" ON modelos_ml;
DROP POLICY IF EXISTS "visor_select_modelos" ON modelos_ml;
CREATE POLICY "admin_full_access" ON modelos_ml FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_select_modelos" ON modelos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria');
CREATE POLICY "visor_select_modelos" ON modelos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

-- ============================================================
-- predicciones_ml
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON predicciones_ml;
DROP POLICY IF EXISTS "operador_predicciones" ON predicciones_ml;
DROP POLICY IF EXISTS "visor_select_predicciones" ON predicciones_ml;
CREATE POLICY "admin_full_access" ON predicciones_ml FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_predicciones" ON predicciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_predicciones" ON predicciones_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- inferencias
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON inferencias;
DROP POLICY IF EXISTS "operador_inferencias" ON inferencias;
DROP POLICY IF EXISTS "visor_select_inferencias" ON inferencias;
CREATE POLICY "admin_full_access" ON inferencias FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_inferencias" ON inferencias FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_inferencias" ON inferencias FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- drift_metricas
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON drift_metricas;
DROP POLICY IF EXISTS "operador_select_drift" ON drift_metricas;
DROP POLICY IF EXISTS "visor_select_drift" ON drift_metricas;
CREATE POLICY "admin_full_access" ON drift_metricas FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_select_drift" ON drift_metricas FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria');
CREATE POLICY "visor_select_drift" ON drift_metricas FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

-- ============================================================
-- alertas_ml
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON alertas_ml;
DROP POLICY IF EXISTS "operador_alertas" ON alertas_ml;
DROP POLICY IF EXISTS "visor_select_alertas" ON alertas_ml;
CREATE POLICY "admin_full_access" ON alertas_ml FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_alertas" ON alertas_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_alertas" ON alertas_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- recomendaciones_ml
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON recomendaciones_ml;
DROP POLICY IF EXISTS "operador_recomendaciones" ON recomendaciones_ml;
DROP POLICY IF EXISTS "visor_select_recomendaciones" ON recomendaciones_ml;
CREATE POLICY "admin_full_access" ON recomendaciones_ml FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));
CREATE POLICY "operador_recomendaciones" ON recomendaciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_destino_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_recomendaciones" ON recomendaciones_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (botica_destino_id = obtener_botica_usuario() OR botica_origen_id = obtener_botica_usuario()));

-- ============================================================
-- Limpiar políticas viejas de tablas eliminadas/renombradas
-- ============================================================
DROP POLICY IF EXISTS "lectura_autenticados" ON organizaciones;
DROP POLICY IF EXISTS "lectura_autenticados" ON usuarios;
DROP POLICY IF EXISTS "lectura_autenticados" ON boticas;
DROP POLICY IF EXISTS "lectura_autenticados" ON productos;
DROP POLICY IF EXISTS "lectura_autenticados" ON proveedores;
DROP POLICY IF EXISTS "lectura_autenticados" ON stock_ubicaciones;
DROP POLICY IF EXISTS "lectura_autenticados" ON lotes;
DROP POLICY IF EXISTS "lectura_autenticados" ON movimientos_inventario;
DROP POLICY IF EXISTS "lectura_autenticados" ON transferencias;
DROP POLICY IF EXISTS "lectura_autenticados" ON transferencias_items;
DROP POLICY IF EXISTS "lectura_autenticados" ON precios;
DROP POLICY IF EXISTS "lectura_autenticados" ON ordenes_compra;
DROP POLICY IF EXISTS "lectura_autenticados" ON ordenes_compra_items;
DROP POLICY IF EXISTS "lectura_autenticados" ON modelos_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON predicciones_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON inferencias;
DROP POLICY IF EXISTS "lectura_autenticados" ON drift_metricas;
DROP POLICY IF EXISTS "lectura_autenticados" ON alertas_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON recomendaciones_ml;
