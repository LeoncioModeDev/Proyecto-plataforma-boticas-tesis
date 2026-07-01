-- ============================================================
-- Migracion 42: cierre de importacion stock_historico
-- ============================================================

BEGIN;

-- Supabase/PostgREST requiere que onConflict apunte a una restriccion/indice
-- unico con las mismas columnas. Este indice respalda el upsert de boticas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_historico_importacion_unique
  ON public.stock_historico(org_id, producto_id, ubicacion_tipo, ubicacion_id, fecha_snapshot_dia);

-- Recuperacion anti-trabado: una importacion no debe quedar indefinidamente
-- en procesando si una version anterior fallo fuera del flujo controlado.
UPDATE public.importaciones_datos
SET
  estado = 'fallida',
  detalle_error = 'Importacion marcada como fallida por recuperacion anti-trabado',
  modified_at = now()
WHERE estado = 'procesando';

COMMIT;
