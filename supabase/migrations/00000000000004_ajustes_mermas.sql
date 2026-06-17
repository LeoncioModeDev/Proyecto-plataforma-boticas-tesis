-- ============================================================
-- 4. Ajustes y Mermas: direccion_ajuste + trigger actualizado
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Agregar columna direccion_ajuste a movimientos_inventario
-- ============================================================
ALTER TABLE movimientos_inventario
ADD COLUMN IF NOT EXISTS direccion_ajuste text
CHECK (direccion_ajuste IN ('incremento', 'decremento'));

-- ============================================================
-- 2. Actualizar trigger actualizar_stock
-- Maneja: entrada, salida, merma, ajuste (con direccion)
-- También actualiza lotes.cantidad para merma y ajuste
-- ============================================================
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

  ELSIF NEW.tipo_movimiento = 'salida' THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);

  ELSIF NEW.tipo_movimiento = 'merma' THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);

    IF NEW.lote_id IS NOT NULL THEN
      UPDATE lotes
      SET cantidad = GREATEST(cantidad - NEW.cantidad, 0)
      WHERE id = NEW.lote_id;
    END IF;

  ELSIF NEW.tipo_movimiento = 'ajuste' THEN
    IF NEW.direccion_ajuste = 'incremento' THEN
      UPDATE stock_ubicaciones
      SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
          updated_at = now()
      WHERE producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);

      IF NEW.lote_id IS NOT NULL THEN
        UPDATE lotes
        SET cantidad = cantidad + NEW.cantidad
        WHERE id = NEW.lote_id;
      END IF;

    ELSIF NEW.direccion_ajuste = 'decremento' THEN
      UPDATE stock_ubicaciones
      SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
          updated_at = now()
      WHERE producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);

      IF NEW.lote_id IS NOT NULL THEN
        UPDATE lotes
        SET cantidad = GREATEST(cantidad - NEW.cantidad, 0)
        WHERE id = NEW.lote_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger (por si acaso)
DROP TRIGGER IF EXISTS trg_actualizar_stock ON movimientos_inventario;
CREATE TRIGGER trg_actualizar_stock
AFTER INSERT ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION actualizar_stock();

COMMIT;
