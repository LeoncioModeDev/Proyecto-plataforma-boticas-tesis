BEGIN;

-- ============================================================
-- Migration 15: Fix doble conteo en trigger al recibir/enviar transferencias
-- ============================================================
-- La Edge Function de transferencias ya actualiza stock_ubicaciones
-- y lotes mediante RPCs (decrementar_lote, decrementar_stock_ubicacion,
-- incrementar_stock_ubicacion). El trigger trg_actualizar_stock se
-- dispara al insertar movimientos_inventario y duplica esas operaciones,
-- causando doble descuento en envío y doble incremento en recepción.
--
-- Solución: el trigger ignora movimientos que pertenecen a una
-- transferencia (transferencia_id IS NOT NULL), ya que la Edge Function
-- maneja todo el stock de forma explícita.
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS trigger AS $$
BEGIN
  -- Los movimientos de transferencia ya son manejados por la Edge Function
  -- mediante RPCs atómicas (decrementar_lote, decrementar_stock_ubicacion,
  -- incrementar_stock_ubicacion). El trigger solo debe actuar sobre
  -- movimientos directos (OC, ajustes, mermas).
  IF NEW.transferencia_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
