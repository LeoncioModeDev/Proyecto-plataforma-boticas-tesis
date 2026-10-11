-- ============================================================
-- Migration 12: Nuevos valores del enum estado_transferencia
-- Separada de migration 10 porque ALTER TYPE ... ADD VALUE debe
-- estar en su propia transacción.
-- ============================================================

ALTER TYPE estado_transferencia ADD VALUE IF NOT EXISTS 'rechazada';
ALTER TYPE estado_transferencia ADD VALUE IF NOT EXISTS 'pendiente_devolucion';
