BEGIN;

-- ============================================================
-- Migration 09: drogueria_id for admin_central / operador_drogueria
-- ============================================================
-- admin_central y operador_drogueria se asocian a la droguería
-- central mediante drogueria_id (no botica_id).
-- botica_id queda exclusivamente para visor_botica.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS drogueria_id uuid REFERENCES boticas(id);

-- Backfill: asigna la droguería de la org a los usuarios existentes
UPDATE usuarios u SET drogueria_id = (
  SELECT b.id FROM boticas b
  WHERE b.org_id = u.org_id AND b.tipo = 'drogueria'
  LIMIT 1
) WHERE u.rol IN ('admin_central', 'operador_drogueria')
  AND u.drogueria_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_drogueria ON usuarios(drogueria_id);

COMMIT;
