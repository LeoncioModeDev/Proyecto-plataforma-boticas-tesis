-- ============================================================
-- 3. Flujo completo OC → Recepción → Lotes → Movimientos → Stock
-- ============================================================

BEGIN;

-- 1. Agregar nuevos estados
ALTER TYPE estado_orden_compra ADD VALUE IF NOT EXISTS 'por_recibir';
ALTER TYPE estado_orden_compra ADD VALUE IF NOT EXISTS 'en_devolucion';

-- 2. Agregar stock_en_transito a stock_ubicaciones
ALTER TABLE stock_ubicaciones ADD COLUMN IF NOT EXISTS stock_en_transito int NOT NULL DEFAULT 0;

-- 3. Agregar resultado y motivo_rechazo a recepciones_orden
ALTER TABLE recepciones_orden ADD COLUMN IF NOT EXISTS resultado text;
ALTER TABLE recepciones_orden ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- 4. Corregir trigger actualizar_stock: remover 'devolucion' de la condición de entrada
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimiento = 'entrada' THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
        stock_por_recibir = GREATEST(stock_por_recibir - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  ELSIF NEW.tipo_movimiento IN ('salida', 'merma') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
