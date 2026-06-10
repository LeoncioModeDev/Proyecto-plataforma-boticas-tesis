-- ============================================================
-- Migración completa — botica-demand-ml → Supabase
-- Ejecutar en SQL Editor de Supabase o via psql
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
  simbolo  char(1) NOT NULL
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
CREATE INDEX idx_principios_activos_nombre ON principios_activos(nombre);

-- ============================================================
-- Tabla: formas_farmaceuticas
-- ============================================================
CREATE TABLE IF NOT EXISTS formas_farmaceuticas (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE
);

-- ============================================================
-- Tabla: presentaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS presentaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_empaque  text NOT NULL,
  cantidad      integer NOT NULL,
  unidad        text NOT NULL,
  UNIQUE (tipo_empaque, cantidad, unidad)
);

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

-- NOTA: El trigger BEFORE insert se eliminó porque es redundante:
--       admin.createUser() ya envía app_metadata explícitamente,
--       y para registros públicos no se usa (solo creación vía API admin).

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
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizaciones(id),
  codigo_interno        text NOT NULL UNIQUE,
  nombre_comercial      text NOT NULL,
  forma_farmaceutica_id uuid REFERENCES formas_farmaceuticas(id),
  presentacion_id       uuid REFERENCES presentaciones(id),
  codigo_barras         text UNIQUE,
  clasificacion         clasificacion_producto NOT NULL,
  estado                estado_producto NOT NULL DEFAULT 'activo',
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz,
  modified_by           uuid REFERENCES usuarios(id)
);
CREATE INDEX idx_productos_org ON productos(org_id);
CREATE INDEX idx_productos_buscador ON productos USING gin (nombre_comercial gin_trgm_ops);

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
CREATE INDEX idx_producto_pa_producto ON producto_principio_activo(producto_id);
CREATE INDEX idx_producto_pa_pa ON producto_principio_activo(principio_activo_id);

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
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_identificacion, numero_identificacion)
);
CREATE INDEX idx_proveedores_org ON proveedores(org_id);

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
CREATE INDEX idx_contactos_proveedor ON contactos_proveedor(proveedor_id);

-- ============================================================
-- Tabla: condiciones_comerciales
-- ============================================================
CREATE TABLE IF NOT EXISTS condiciones_comerciales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id        uuid NOT NULL REFERENCES proveedores(id),
  moneda_id           uuid NOT NULL REFERENCES monedas(id),
  plazo_pago          text NOT NULL,
  lead_time_promedio  int NOT NULL,
  observaciones       text
);
CREATE INDEX idx_condiciones_comerciales_proveedor ON condiciones_comerciales(proveedor_id);

-- ============================================================
-- Tabla: proveedor_producto
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedor_producto (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          uuid NOT NULL REFERENCES proveedores(id),
  producto_id           uuid NOT NULL REFERENCES productos(id),
  lead_time_especifico  int NOT NULL,
  precio_compra         numeric(10,2) NOT NULL,
  UNIQUE (proveedor_id, producto_id)
);
CREATE INDEX idx_proveedor_producto_proveedor ON proveedor_producto(proveedor_id);
CREATE INDEX idx_proveedor_producto_producto ON proveedor_producto(producto_id);

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
CREATE INDEX idx_precios_producto ON precios(producto_id);

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
CREATE UNIQUE INDEX idx_stock_ubicaciones_unique
  ON stock_ubicaciones (producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX idx_stock_producto ON stock_ubicaciones(producto_id);
CREATE INDEX idx_stock_ubicacion ON stock_ubicaciones(ubicacion_tipo, ubicacion_id);

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
CREATE UNIQUE INDEX idx_lotes_unique
  ON lotes (producto_id, numero_lote, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX idx_lotes_producto ON lotes(producto_id);
CREATE INDEX idx_lotes_vencimiento ON lotes(fecha_vencimiento);

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
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_inventario(created_at);
CREATE INDEX idx_movimientos_tipo ON movimientos_inventario(tipo_movimiento);

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
CREATE INDEX idx_transferencias_destino ON transferencias(destino_id);
CREATE INDEX idx_transferencias_estado ON transferencias(estado);

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
CREATE INDEX idx_transferencias_items_transferencia ON transferencias_items(transferencia_id);

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
CREATE INDEX idx_oc_proveedor ON ordenes_compra(proveedor_id);
CREATE INDEX idx_oc_estado ON ordenes_compra(estado);

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
CREATE INDEX idx_oc_items_orden ON ordenes_compra_items(orden_compra_id);

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
CREATE UNIQUE INDEX idx_modelos_ml_production ON modelos_ml (status) WHERE status = 'production';

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
CREATE INDEX idx_predicciones_producto_botica ON predicciones_ml(producto_id, botica_id);

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
CREATE INDEX idx_inferencias_modelo_fecha ON inferencias(modelo_version_id, fecha_pred);
CREATE INDEX idx_inferencias_producto_botica ON inferencias(producto_id, botica_id, fecha_pred);

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
CREATE INDEX idx_drift_modelo_fecha ON drift_metricas(modelo_version_id, fecha_calculo);

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
CREATE INDEX idx_alertas_botica ON alertas_ml(botica_id);
CREATE INDEX idx_alertas_resuelta ON alertas_ml(resuelta);

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
CREATE INDEX idx_recomendaciones_estado ON recomendaciones_ml(estado);

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
