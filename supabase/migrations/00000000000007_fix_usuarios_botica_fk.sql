BEGIN;

-- ============================================================
-- Fix: add FK constraint from usuarios.botica_id → boticas(id)
-- The column existed from migration 00 but without a FK constraint,
-- so migration 06's ADD COLUMN IF NOT EXISTS was a no-op.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'usuarios'
      AND constraint_name = 'usuarios_botica_id_fkey'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_botica_id_fkey
      FOREIGN KEY (botica_id) REFERENCES boticas(id);
  END IF;
END $$;

COMMIT;
