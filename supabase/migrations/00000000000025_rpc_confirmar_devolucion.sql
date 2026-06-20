BEGIN;

CREATE OR REPLACE FUNCTION public.confirmar_devolucion_origen(
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
  v_lote_origen RECORD;
  v_lote_destino RECORD;
  v_stock_encontrado BOOLEAN;
BEGIN
  -- Bloquear la fila de la transferencia
  SELECT * INTO v_transferencia
  FROM transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado != 'pendiente_devolucion' THEN
    RAISE EXCEPTION E'Estado inválido: %. Solo se puede confirmar devolución en estado "pendiente_devolucion"',
      v_transferencia.estado;
  END IF;

  -- Procesar cada item en orden
  FOR v_item IN
    SELECT ti.*, l.numero_lote, l.fecha_vencimiento, l.proveedor_id
    FROM transferencias_items ti
    JOIN lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
  LOOP
    -- 1. Restaurar cantidad_disponible en origen
    IF v_transferencia.origen_tipo = 'drogueria' THEN
      UPDATE stock_ubicaciones
      SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
          updated_at = NOW()
      WHERE producto_id = v_item.producto_id
        AND ubicacion_tipo = 'drogueria'
        AND (ubicacion_id IS NOT DISTINCT FROM NULL);

      IF NOT FOUND THEN
        INSERT INTO stock_ubicaciones (
          producto_id, ubicacion_tipo, ubicacion_id,
          cantidad_disponible, stock_minimo, stock_por_recibir, stock_en_transito,
          org_id, updated_at
        )
        VALUES (
          v_item.producto_id, 'drogueria', NULL,
          v_item.cantidad, 0, 0, 0,
          v_transferencia.org_id, NOW()
        );
      END IF;

      -- 2. Restaurar cantidad al lote original (droguería, ubicacion_id IS NULL)
      UPDATE lotes
      SET cantidad = cantidad + v_item.cantidad
      WHERE id = v_item.lote_id;

    ELSIF v_transferencia.origen_tipo = 'botica' THEN
      UPDATE stock_ubicaciones
      SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
          updated_at = NOW()
      WHERE producto_id = v_item.producto_id
        AND ubicacion_tipo = 'botica'
        AND ubicacion_id = v_transferencia.origen_id;

      IF NOT FOUND THEN
        INSERT INTO stock_ubicaciones (
          producto_id, ubicacion_tipo, ubicacion_id,
          cantidad_disponible, stock_minimo, stock_por_recibir, stock_en_transito,
          org_id, updated_at
        )
        VALUES (
          v_item.producto_id, 'botica', v_transferencia.origen_id,
          v_item.cantidad, 0, 0, 0,
          v_transferencia.org_id, NOW()
        );
      END IF;

      -- 2. Restaurar cantidad al lote original en botica origen
      -- Buscar el lote original por producto + numero_lote + ubicacion origen
      SELECT id, cantidad INTO v_lote_origen
      FROM lotes
      WHERE producto_id = v_item.producto_id
        AND numero_lote = v_item.numero_lote
        AND ubicacion_tipo = v_transferencia.origen_tipo
        AND ubicacion_id = v_transferencia.origen_id;

      IF FOUND THEN
        UPDATE lotes
        SET cantidad = cantidad + v_item.cantidad
        WHERE id = v_lote_origen.id;
      ELSE
        -- Si no existe (limpieza), crear registro
        INSERT INTO lotes (
          producto_id, ubicacion_tipo, ubicacion_id,
          numero_lote, fecha_vencimiento, cantidad, proveedor_id, org_id
        )
        VALUES (
          v_item.producto_id, v_transferencia.origen_tipo, v_transferencia.origen_id,
          v_item.numero_lote, v_item.fecha_vencimiento,
          v_item.cantidad, v_item.proveedor_id, v_transferencia.org_id
        );
      END IF;
    END IF;

    -- 3. Insertar movimiento de devolución en la ubicación origen
    INSERT INTO movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, v_transferencia.origen_tipo,
      CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END,
      'devolucion', v_item.cantidad, 'Devolución de transferencia rechazada a origen',
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  -- 4. Actualizar estado
  UPDATE transferencias
  SET estado = 'devuelta_a_origen'
  WHERE id = p_transferencia_id;

  -- 5. Registrar auditoría
  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle
  )
  VALUES (
    v_transferencia.org_id, p_usuario_id, 'CONFIRMAR_DEVOLUCION_ORIGEN',
    'transferencias', p_transferencia_id, 'info',
    format(
      'Se confirmó devolución a origen de transferencia rechazada — %s producto(s)',
      (SELECT count(*) FROM transferencias_items WHERE transferencia_id = p_transferencia_id)
    )
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'devuelta_a_origen');
END;
$$;

COMMIT;
