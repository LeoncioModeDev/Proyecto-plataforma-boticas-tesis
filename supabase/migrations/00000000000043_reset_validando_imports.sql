-- ============================================================
-- Migracion 43: recuperar importaciones trabadas en validando
-- ============================================================

BEGIN;

UPDATE public.importaciones_datos
SET
  estado = 'fallida',
  detalle_error = 'Importacion marcada como fallida por quedar trabada en validando antes del fix de progreso',
  modified_at = now()
WHERE estado = 'validando';

COMMIT;
