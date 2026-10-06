BEGIN;

-- ============================================================
-- 1. Agregar org_id a ordenes_compra
-- ============================================================
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
UPDATE ordenes_compra SET org_id = proveedores.org_id
FROM proveedores WHERE ordenes_compra.proveedor_id = proveedores.id;
ALTER TABLE ordenes_compra ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oc_org ON ordenes_compra(org_id);

-- ============================================================
-- 2. Agregar moneda_id a ordenes_compra (FK directa)
-- ============================================================
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS moneda_id uuid REFERENCES monedas(id);

-- ============================================================
-- 3. Actualizar políticas RLS de ordenes_compra
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ordenes_compra;
DROP POLICY IF EXISTS "operador_oc" ON ordenes_compra;
DROP POLICY IF EXISTS "visor_select_oc" ON ordenes_compra;

CREATE POLICY "admin_full_access" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));

CREATE POLICY "operador_oc" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND org_id = obtener_org_usuario());

CREATE POLICY "visor_select_oc" ON ordenes_compra FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND org_id = obtener_org_usuario());

-- ============================================================
-- 4. Actualizar políticas RLS de ordenes_compra_items
--    para usar org_id directo de ordenes_compra
-- ============================================================
DROP POLICY IF EXISTS "operador_oc_items" ON ordenes_compra_items;
CREATE POLICY "operador_oc_items" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM ordenes_compra oc
      WHERE oc.id = orden_compra_id AND oc.org_id = obtener_org_usuario()));

COMMIT;
