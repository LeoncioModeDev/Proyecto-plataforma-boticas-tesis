BEGIN;

CREATE OR REPLACE FUNCTION public.rechazar_transferencia(
  p_transferencia_id UUID,
  p_usuario_id UUID,
  p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_transferencia RECORD;
  v_count INT;
  v_item_count INT;
BEGIN
  SELECT * INTO v_transferencia
  FROM transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado != 'en_transito' THEN
    RAISE EXCEPTION E'Estado inválido: %. Solo se pueden rechazar transferencias en estado "en_transito"',
      v_transferencia.estado;
  END IF;

  SELECT count(*) INTO v_item_count
  FROM transferencias_items
  WHERE transferencia_id = p_transferencia_id;

  FOR v_item IN
    SELECT * FROM transferencias_items
    WHERE transferencia_id = p_transferencia_id
    ORDER BY id
  LOOP
    UPDATE stock_ubicaciones
    SET stock_en_transito = GREATEST(stock_en_transito - v_item.cantidad, 0),
        updated_at = NOW()
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_transferencia.destino_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count = 0 THEN
      RAISE EXCEPTION E'Registro de stock en tránsito no encontrado en botica\nProducto: %\nBotica: %',
        v_item.producto_id, v_transferencia.destino_id;
    END IF;
  END LOOP;

  UPDATE transferencias
  SET estado = 'pendiente_devolucion',
      motivo_rechazo = p_motivo,
      fecha_recepcion = NOW()
  WHERE id = p_transferencia_id;

  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle
  )
  VALUES (
    v_transferencia.org_id, p_usuario_id, 'RECHAZAR_TRANSFERENCIA',
    'transferencias', p_transferencia_id, 'advertencia',
    format(
      'Se rechazó recepción de transferencia — pendiente de devolución. Motivo: %s. %s producto(s)',
      p_motivo, v_item_count
    )
  );

  RETURN jsonb_build_object(
    'exito', true,
    'estado', 'pendiente_devolucion',
    'id', p_transferencia_id
  );
END;
$$;

COMMIT;
