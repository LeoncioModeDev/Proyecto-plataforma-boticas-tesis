-- ============================================================
-- Migracion 45: compatibilidad con historial remoto
-- ============================================================
-- La base remota ya registro esta version durante la preparacion del
-- flujo de aprobacion. Mantenerla local evita reescribir historial.

ALTER TYPE public.estado_transferencia ADD VALUE IF NOT EXISTS 'aprobada';
