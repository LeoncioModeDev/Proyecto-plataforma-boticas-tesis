BEGIN;

-- ============================================================
-- Migration 19: RPC transaccional para enviar transferencia
-- ============================================================
-- Reemplaza los 4 RPCs/secuenciales de la Edge Function por un
-- único RPC que ejecuta todo en una sola transacción.
--
-- Si cualquier paso falla (stock insuficiente, lote no encontrado),
-- se lanza RAISE EXCEPTION y PostgreSQL revierte TODO:
--   • lotes.cantidad     ← se restaura
--   • stock_ubicaciones  ← se restaura
--   • movimientos        ← no se inserta
--   • transferencias     ← no cambia de estado
--
-- Antes: 4 llamadas separadas → cada una commit independiente
-- Después: 1 llamada → 1 transacción atómica
-- ============================================================

CREATE OR REPLACE FUNCTION public.enviar_transferencia(
  p_transferencia_id UUID,
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_transferencia RECORD;
  v_cantidad_lote INT;
  v_cantidad_stock INT;
  v_stock_destino RECORD;
BEGIN
  -- Bloquear la fila de la transferencia (evita condición de carrera)
  SELECT * INTO v_transferencia
  FROM transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id
      USING HINT = 'Verifica que el ID de transferencia sea correcto';
  END IF;

  IF v_transferencia.estado != 'creada' THEN
    RAISE EXCEPTION 'Estado inválido: %. Solo se pueden enviar transferencias en estado "creada"', v_transferencia.estado
      USING HINT = 'Las transferencias ya enviadas, recibidas o canceladas no pueden reenviarse';
  END IF;

  -- Procesar cada item en orden
  FOR v_item IN
    SELECT * FROM transferencias_items
    WHERE transferencia_id = p_transferencia_id
    ORDER BY id
  LOOP
    -- 1. Decrementar lote (con chequeo de stock suficiente)
    UPDATE lotes
    SET cantidad = cantidad - v_item.cantidad
    WHERE id = v_item.lote_id AND cantidad >= v_item.cantidad;

    IF NOT FOUND THEN
      SELECT cantidad INTO v_cantidad_lote FROM lotes WHERE id = v_item.lote_id;
      RAISE EXCEPTION E'Stock insuficiente en lote\nProducto: %\nLote: %\nSolicitado: %\nDisponible: %',
        v_item.producto_id, v_item.lote_id, v_item.cantidad, COALESCE(v_cantidad_lote, 0)
        USING HINT = 'Verifica que el lote tenga cantidad suficiente antes de enviar';
    END IF;

    -- 2. Decrementar stock_ubicacion en droguería (ubicacion_id IS NULL)
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible - v_item.cantidad,
        updated_at = NOW()
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'drogueria'
      AND (ubicacion_id IS NOT DISTINCT FROM NULL)
      AND cantidad_disponible >= v_item.cantidad;

    IF NOT FOUND THEN
      SELECT cantidad_disponible INTO v_cantidad_stock
      FROM stock_ubicaciones
      WHERE producto_id = v_item.producto_id
        AND ubicacion_tipo = 'drogueria'
        AND (ubicacion_id IS NOT DISTINCT FROM NULL);

      RAISE EXCEPTION E'Stock insuficiente en droguería\nProducto: %\nSolicitado: %\nDisponible en ubicación: %',
        v_item.producto_id, v_item.cantidad, COALESCE(v_cantidad_stock, 0)
        USING HINT = 'Puede que no exista un registro de stock_ubicaciones para este producto en la droguería';
    END IF;

    -- 3. Aumentar stock_en_transito en botica destino
    -- (mismo patrón que la Edge Function actual: SELECT → UPDATE/INSERT)
    SELECT id, stock_en_transito INTO v_stock_destino
    FROM stock_ubicaciones
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_transferencia.destino_id;

    IF FOUND THEN
      UPDATE stock_ubicaciones
      SET stock_en_transito = stock_en_transito + v_item.cantidad,
          updated_at = NOW()
      WHERE id = v_stock_destino.id;
    ELSE
      INSERT INTO stock_ubicaciones (
        producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_por_recibir, stock_en_transito,
        org_id, updated_at
      )
      VALUES (
        v_item.producto_id, 'botica', v_transferencia.destino_id,
        0, 0, 0, v_item.cantidad,
        v_transferencia.org_id, NOW()
      );
    END IF;

    -- 4. Insertar movimiento de salida (el trigger lo ignora por transferencia_id)
    INSERT INTO movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, 'drogueria', NULL,
      'salida', v_item.cantidad, 'Envío de transferencia a botica',
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  -- 5. Actualizar estado de la transferencia
  UPDATE transferencias
  SET estado = 'en_transito',
      fecha_despacho = NOW()
  WHERE id = p_transferencia_id;

  -- 6. Registrar auditoría
  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle
  )
  VALUES (
    v_transferencia.org_id, p_usuario_id, 'ENVIAR_TRANSFERENCIA',
    'transferencias', p_transferencia_id, 'info',
    format(
      'Se envió transferencia a botica — %s producto(s)',
      (SELECT count(*) FROM transferencias_items WHERE transferencia_id = p_transferencia_id)
    )
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'en_transito');
END;
$$;

COMMIT;
