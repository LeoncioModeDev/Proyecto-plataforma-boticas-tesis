-- ============================================================
-- 5. Rechazo y Cancelación de OC: columnas específicas
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Agregar columnas de rechazo
-- ============================================================
ALTER TABLE ordenes_compra
ADD COLUMN IF NOT EXISTS rechazado_por    uuid,
ADD COLUMN IF NOT EXISTS fecha_rechazo    timestamptz,
ADD COLUMN IF NOT EXISTS motivo_rechazo   text;

-- ============================================================
-- 2. Agregar columnas de cancelación
-- ============================================================
ALTER TABLE ordenes_compra
ADD COLUMN IF NOT EXISTS cancelado_por      uuid,
ADD COLUMN IF NOT EXISTS fecha_cancelacion  timestamptz,
ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

COMMIT;
