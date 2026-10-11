BEGIN;

-- ============================================================
-- Migration 08: Admin Module — Business Rules & Uniqueness
-- ============================================================
-- 1. One drogueria per organization (partial unique index)
-- 2. One admin_central per organization (partial unique index)
-- 3. Add org_id to transferencias and transferencias_items
-- ============================================================

-- ============================================================
-- 1. Una sola droguería por organización
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_boticas_unica_drogueria_org
  ON boticas(org_id) WHERE tipo = 'drogueria';

-- ============================================================
-- 2. Un solo admin_central por organización
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_unico_admin_central_org
  ON usuarios(org_id) WHERE rol = 'admin_central';

-- ============================================================
-- 3. Agregar org_id a transferencias
-- ============================================================
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizaciones ORDER BY created_at LIMIT 1;

  -- Backfill: set org_id from the origen/destino botica
  UPDATE transferencias t
    SET org_id = COALESCE(
      (SELECT b.org_id FROM boticas b WHERE b.id = t.origen_id),
      (SELECT b.org_id FROM boticas b WHERE b.id = t.destino_id)
    )
    WHERE t.org_id IS NULL;

  IF v_org_id IS NOT NULL THEN
    UPDATE transferencias SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
END $$;

ALTER TABLE transferencias ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transferencias_org ON transferencias(org_id);

-- ============================================================
-- 4. Agregar org_id a transferencias_items
-- ============================================================
ALTER TABLE transferencias_items ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);

UPDATE transferencias_items ti
  SET org_id = t.org_id
  FROM transferencias t
  WHERE ti.transferencia_id = t.id AND ti.org_id IS NULL;

ALTER TABLE transferencias_items ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transferencias_items_org ON transferencias_items(org_id);

COMMIT;
