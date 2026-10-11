-- ============================================================
-- Migration 13: Actualizar policy visor_update_transferencias
-- Ahora que 'rechazada' existe en el enum, la agregamos a la
-- WITH CHECK del policy.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "visor_update_transferencias" ON transferencias;

CREATE POLICY "visor_update_transferencias" ON transferencias FOR UPDATE
  USING (
    obtener_rol_usuario() = 'visor_botica'
    AND destino_id = obtener_botica_usuario()
    AND estado = 'en_transito'
  )
  WITH CHECK (
    estado IN ('recibida', 'rechazada')
  );

COMMIT;
