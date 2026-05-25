-- ============================================================
-- limpiar.sql — Elimina TODO lo creado por migracion.sql + rls.sql + semilla.sql
-- Orden inverso al de creación para respetar dependencias.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_actualizar_stock ON movimientos_inventario;
DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_after_insert ON auth.users;

-- ============================================================
-- 2. Funciones
-- ============================================================
DROP FUNCTION IF EXISTS public.actualizar_stock() CASCADE;
DROP FUNCTION IF EXISTS public.setear_app_metadata() CASCADE;
DROP FUNCTION IF EXISTS public.sincronizar_usuario() CASCADE;
DROP FUNCTION IF EXISTS public.obtener_rol_usuario() CASCADE;
DROP FUNCTION IF EXISTS public.obtener_org_usuario() CASCADE;
DROP FUNCTION IF EXISTS public.obtener_botica_usuario() CASCADE;

-- ============================================================
-- 3. Tablas (orden inverso al de creación)
-- ============================================================
DROP TABLE IF EXISTS recomendaciones_ml CASCADE;
DROP TABLE IF EXISTS alertas_ml CASCADE;
DROP TABLE IF EXISTS drift_metricas CASCADE;
DROP TABLE IF EXISTS inferencias CASCADE;
DROP TABLE IF EXISTS predicciones_ml CASCADE;
DROP TABLE IF EXISTS modelos_ml CASCADE;
DROP TABLE IF EXISTS ordenes_compra_items CASCADE;
DROP TABLE IF EXISTS ordenes_compra CASCADE;
DROP TABLE IF EXISTS transferencias_items CASCADE;
DROP TABLE IF EXISTS transferencias CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS lotes CASCADE;
DROP TABLE IF EXISTS stock_ubicaciones CASCADE;
DROP TABLE IF EXISTS precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TABLE IF EXISTS boticas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS paises CASCADE;
DROP TABLE IF EXISTS ubigeos CASCADE;
DROP TABLE IF EXISTS organizaciones CASCADE;

-- ============================================================
-- 4. Tipos enum (orden inverso al de creación)
-- ============================================================
DROP TYPE IF EXISTS rol_usuario;
DROP TYPE IF EXISTS estado_orden_compra;
DROP TYPE IF EXISTS estado_recomendacion;
DROP TYPE IF EXISTS estado_modelo;
DROP TYPE IF EXISTS tendencia_drift;
DROP TYPE IF EXISTS urgencia_alerta;
DROP TYPE IF EXISTS tipo_origen_alerta;
DROP TYPE IF EXISTS tipo_alerta;
DROP TYPE IF EXISTS estado_producto;
DROP TYPE IF EXISTS clasificacion_producto;
DROP TYPE IF EXISTS tipo_identificacion;
DROP TYPE IF EXISTS estado_transferencia;
DROP TYPE IF EXISTS tipo_transferencia;
DROP TYPE IF EXISTS tipo_movimiento;
DROP TYPE IF EXISTS tipo_ubicacion;

COMMIT;

-- ============================================================
-- 5. Datos seed en auth.users (no se borran con DROP TABLE)
--    Ejecutar SOLO si se desea eliminar los usuarios seed
--    (requiere service_role, ejecutar desde Node.js o SQL Editor
--     con permisos):
-- ============================================================
-- DELETE FROM auth.users WHERE email IN (
--   'carlos@boticaml.pe',
--   'ana@boticaml.pe',
--   'luis@boticaml.pe'
-- );

-- ============================================================
-- 6. Extensiones (NO se eliminan por defecto; otras tablas del
--    proyecto podrían depender de ellas). Descomentar si se
--    requiere una limpieza total:
-- ============================================================
-- DROP EXTENSION IF EXISTS pg_cron;
-- DROP EXTENSION IF EXISTS pg_net;
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS "uuid-ossp";
