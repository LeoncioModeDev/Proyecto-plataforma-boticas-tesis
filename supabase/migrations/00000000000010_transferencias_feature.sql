BEGIN;

-- ============================================================
-- Migration 10: Transferencias — Feature completa
-- ============================================================
-- 1. Agrega columnas a transferencias (motivo_rechazo, observaciones)
-- 2. Actualiza RLS policies para usar org_id directamente
-- Los nuevos valores del enum (rechazada, pendiente_devolucion)
-- se agregan en la migración 12 (no pueden estar en la misma
-- transacción que CREATE POLICY que los referencie).
-- ============================================================

-- ============================================================
-- 2. Columnas adicionales
-- ============================================================
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS motivo_rechazo text;
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS observaciones text;

-- ============================================================
-- 3. RLS — transferencias
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias;
DROP POLICY IF EXISTS "operador_transferencias" ON transferencias;
DROP POLICY IF EXISTS "visor_select_transferencias" ON transferencias;

-- admin_central y operador_drogueria: ALL sobre su org
CREATE POLICY "admin_transferencias" ON transferencias FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() IN ('admin_central', 'operador_drogueria') AND org_id = obtener_org_usuario())
  );

-- visor_botica: solo SELECT donde destino es su botica
CREATE POLICY "visor_select_transferencias" ON transferencias FOR SELECT
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND destino_id = obtener_botica_usuario()
  );

-- visor_botica: UPDATE solo para recibir/rechazar en_transito
CREATE POLICY "visor_update_transferencias" ON transferencias FOR UPDATE
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND destino_id = obtener_botica_usuario()
    AND estado = 'en_transito'
  )
  WITH CHECK (
    estado IN ('recibida')
  );

-- ============================================================
-- 4. RLS — transferencias_items
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias_items;
DROP POLICY IF EXISTS "operador_transferencias_items" ON transferencias_items;
DROP POLICY IF EXISTS "visor_select_transferencias_items" ON transferencias_items;

CREATE POLICY "admin_transferencias_items" ON transferencias_items FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() IN ('admin_central', 'operador_drogueria')
        AND EXISTS (SELECT 1 FROM transferencias t WHERE t.id = transferencia_id AND t.org_id = obtener_org_usuario()))
  );

CREATE POLICY "visor_select_transferencias_items" ON transferencias_items FOR SELECT
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM transferencias t
      WHERE t.id = transferencia_id AND t.destino_id = obtener_botica_usuario())
  );

COMMIT;
