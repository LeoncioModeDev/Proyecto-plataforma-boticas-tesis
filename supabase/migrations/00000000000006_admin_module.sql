BEGIN;

-- ============================================================
-- Migration 06: Módulo Administración (Multi-tenant)
-- ============================================================
-- 1. Agrega codigo_interno y encargado_usuario_id a boticas
-- 2. Agrega org_id a tablas de inventario que faltaban
-- 3. Simplifica RLS policies con org_id directo
-- 4. Crea tabla auditoria con RLS
-- ============================================================

-- ============================================================
-- 1. Boticas — nuevas columnas
-- ============================================================
ALTER TABLE boticas ADD COLUMN IF NOT EXISTS codigo_interno text;
ALTER TABLE boticas ADD COLUMN IF NOT EXISTS encargado_usuario_id uuid REFERENCES usuarios(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boticas_codigo_org ON boticas(org_id, codigo_interno) WHERE codigo_interno IS NOT NULL;

DO $$
DECLARE
  v_org_id uuid;
  v_counter integer;
  v_row record;
BEGIN
  FOR v_org_id IN SELECT DISTINCT org_id FROM boticas WHERE codigo_interno IS NULL LOOP
    v_counter := 0;
    FOR v_row IN SELECT id FROM boticas WHERE org_id = v_org_id AND codigo_interno IS NULL ORDER BY created_at LOOP
      v_counter := v_counter + 1;
      UPDATE boticas SET codigo_interno = 'BOT-' || LPAD(v_counter::text, 6, '0') WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 2. Agregar org_id a tablas de inventario
-- ============================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizaciones ORDER BY created_at LIMIT 1;

  -- stock_ubicaciones
  ALTER TABLE stock_ubicaciones ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE stock_ubicaciones SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE stock_ubicaciones ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_stock_ubicaciones_org ON stock_ubicaciones(org_id);

  -- lotes
  ALTER TABLE lotes ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE lotes SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE lotes ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_lotes_org ON lotes(org_id);

  -- movimientos_inventario
  ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE movimientos_inventario SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE movimientos_inventario ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_org ON movimientos_inventario(org_id);
END $$;

-- ============================================================
-- 3. Actualizar RLS de boticas (scope por org_id)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON boticas;
CREATE POLICY "admin_full_access" ON boticas FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

DROP POLICY IF EXISTS "operador_boticas" ON boticas;
CREATE POLICY "operador_boticas" ON boticas FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ============================================================
-- 4. Actualizar RLS de usuarios (scope por org_id)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON usuarios;
CREATE POLICY "admin_full_access" ON usuarios FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

DROP POLICY IF EXISTS "operador_usuarios" ON usuarios;
CREATE POLICY "operador_usuarios" ON usuarios FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ============================================================
-- 5. Simplificar RLS de stock_ubicaciones (org_id directo)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON stock_ubicaciones;
CREATE POLICY "admin_full_access" ON stock_ubicaciones FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

DROP POLICY IF EXISTS "operador_stock" ON stock_ubicaciones;
CREATE POLICY "operador_stock" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ============================================================
-- 6. Simplificar RLS de lotes (org_id directo)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON lotes;
CREATE POLICY "admin_full_access" ON lotes FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

DROP POLICY IF EXISTS "operador_lotes" ON lotes;
CREATE POLICY "operador_lotes" ON lotes FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ============================================================
-- 7. Simplificar RLS de movimientos_inventario (org_id directo)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON movimientos_inventario;
CREATE POLICY "admin_full_access" ON movimientos_inventario FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

DROP POLICY IF EXISTS "operador_movimientos" ON movimientos_inventario;
CREATE POLICY "operador_movimientos" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ============================================================
-- 8. Crear tabla auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizaciones(id),
  usuario_id uuid REFERENCES usuarios(id),
  accion text NOT NULL,
  entidad text,
  entidad_id uuid,
  nivel text NOT NULL DEFAULT 'info',
  detalle text,
  metadata_jsonb jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_org ON auditoria(org_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at DESC);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON auditoria FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

CREATE POLICY "operador_select_auditoria" ON auditoria FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

COMMIT;
