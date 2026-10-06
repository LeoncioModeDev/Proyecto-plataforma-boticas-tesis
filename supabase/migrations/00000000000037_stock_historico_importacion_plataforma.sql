-- ============================================================
-- Migracion 37: soporte incremental de importacion stock_historico
-- para paquete sintetico oficial V4.
-- No crea organizaciones ni expone UUID en plantillas publicas.
-- ============================================================

BEGIN;

ALTER TABLE public.stock_historico
  ADD COLUMN IF NOT EXISTS demanda_insatisfecha integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stockout_flag integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_historico_demanda_insatisfecha_no_negativa') THEN
    ALTER TABLE public.stock_historico
      ADD CONSTRAINT chk_stock_historico_demanda_insatisfecha_no_negativa
      CHECK (demanda_insatisfecha >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_historico_stockout_flag_binario') THEN
    ALTER TABLE public.stock_historico
      ADD CONSTRAINT chk_stock_historico_stockout_flag_binario
      CHECK (stockout_flag IN (0, 1)) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.stock_historico.demanda_insatisfecha IS
  'Demanda insatisfecha semanal oficial del dataset sintetico V4. No se deriva automaticamente si el CSV la provee.';
COMMENT ON COLUMN public.stock_historico.stockout_flag IS
  'Indicador semanal oficial de stockout del dataset sintetico V4: 0 o 1.';

ALTER TABLE public.importaciones_datos DROP CONSTRAINT IF EXISTS importaciones_datos_tipo_importacion_check;
ALTER TABLE public.importaciones_datos
  ADD CONSTRAINT importaciones_datos_tipo_importacion_check CHECK (tipo_importacion IN (
    'categorias_terapeuticas', 'boticas', 'productos', 'proveedores',
    'usuarios', 'proveedor_producto', 'precios', 'stock_inicial',
    'stock_historico', 'ventas_historicas'
  ));

COMMIT;
