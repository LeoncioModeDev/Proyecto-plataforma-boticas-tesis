BEGIN;

CREATE OR REPLACE FUNCTION public.enviar_redistribucion(
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
    RAISE EXCEPTION 'Redistribución no encontrada: %', p_transferencia_id
      USING HINT = 'Verifica que el ID de redistribución sea correcto';
  END IF;

  IF v_transferencia.tipo_transferencia != 'redistribucion' THEN
    RAISE EXCEPTION 'La transferencia % no es una redistribución (tipo: %)',
      p_transferencia_id, v_transferencia.tipo_transferencia;
  END IF;

  IF v_transferencia.estado != 'creada' THEN
    RAISE EXCEPTION 'Estado inválido: %. Solo se pueden enviar redistribuciones en estado "creada"', v_transferencia.estado;
  END IF;

  -- Procesar cada item en orden
  FOR v_item IN
    SELECT * FROM transferencias_items
    WHERE transferencia_id = p_transferencia_id
    ORDER BY id
  LOOP
    -- 1. Decrementar lote en botica origen (con chequeo de stock suficiente)
    UPDATE lotes
    SET cantidad = cantidad - v_item.cantidad
    WHERE id = v_item.lote_id AND cantidad >= v_item.cantidad;

    IF NOT FOUND THEN
      SELECT cantidad INTO v_cantidad_lote FROM lotes WHERE id = v_item.lote_id;
      RAISE EXCEPTION E'Stock insuficiente en lote de botica origen\nProducto: %\nLote: %\nSolicitado: %\nDisponible: %',
        v_item.producto_id, v_item.lote_id, v_item.cantidad, COALESCE(v_cantidad_lote, 0);
    END IF;

    -- 2. Decrementar stock_ubicacion en botica origen
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible - v_item.cantidad,
        updated_at = NOW()
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_transferencia.origen_id
      AND cantidad_disponible >= v_item.cantidad;

    IF NOT FOUND THEN
      SELECT cantidad_disponible INTO v_cantidad_stock
      FROM stock_ubicaciones
      WHERE producto_id = v_item.producto_id
        AND ubicacion_tipo = 'botica'
        AND ubicacion_id = v_transferencia.origen_id;

      RAISE EXCEPTION E'Stock insuficiente en botica origen\nProducto: %\nBotica: %\nSolicitado: %\nDisponible: %',
        v_item.producto_id, v_transferencia.origen_id, v_item.cantidad, COALESCE(v_cantidad_stock, 0);
    END IF;

    -- 3. Aumentar stock_en_transito en botica destino
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

    -- 4. Insertar movimiento de salida en botica origen (el trigger lo ignora por transferencia_id)
    INSERT INTO movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, 'botica', v_transferencia.origen_id,
      'salida', v_item.cantidad, 'Envío de redistribución a botica',
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
    v_transferencia.org_id, p_usuario_id, 'ENVIAR_REDISTRIBUCION',
    'transferencias', p_transferencia_id, 'info',
    format(
      'Se envió redistribución de botica a botica — %s producto(s)',
      (SELECT count(*) FROM transferencias_items WHERE transferencia_id = p_transferencia_id)
    )
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'en_transito');
END;
$$;

COMMIT;
