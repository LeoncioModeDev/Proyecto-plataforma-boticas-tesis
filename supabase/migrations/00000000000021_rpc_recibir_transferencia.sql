BEGIN;

-- ============================================================
-- Migration 21: RPC transaccional para recibir transferencia
-- ============================================================
-- Reemplaza los pasos secuenciales de recibirTransferencia()
-- en la Edge Function por un único RPC atómico.
--
-- Si cualquier paso falla, PostgreSQL revierte TODO:
--   • stock_en_transito     ← no se descuenta
--   • cantidad_disponible   ← no se aumenta
--   • lotes en botica       ← no se crean/actualizan
--   • transferencias        ← no cambia de estado
-- ============================================================

CREATE OR REPLACE FUNCTION public.recibir_transferencia(
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
  -- Bloquear la fila de la transferencia (evita condición de carrera)
  SELECT * INTO v_transferencia
  FROM transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado != 'en_transito' THEN
    RAISE EXCEPTION E'Estado inválido: %. Solo se pueden recibir transferencias en estado "en_transito"',
      v_transferencia.estado;
  END IF;

  -- Procesar cada item en orden
  FOR v_item IN
    SELECT * FROM transferencias_items
    WHERE transferencia_id = p_transferencia_id
    ORDER BY id
  LOOP
    -- 1. Disminuir stock_en_transito en botica destino
    UPDATE stock_ubicaciones
    SET stock_en_transito = stock_en_transito - v_item.cantidad,
        updated_at = NOW()
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_transferencia.destino_id
      AND stock_en_transito >= v_item.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION E'Stock en tránsito insuficiente en botica\nProducto: %\nSolicitado: %',
        v_item.producto_id, v_item.cantidad;
    END IF;

    -- 2. Aumentar cantidad_disponible en botica destino
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
        updated_at = NOW()
    WHERE producto_id = v_item.producto_id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_transferencia.destino_id;

    IF NOT FOUND THEN
      -- Si no existe el registro de stock en botica, crearlo
      INSERT INTO stock_ubicaciones (
        producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_por_recibir, stock_en_transito,
        org_id, updated_at
      )
      VALUES (
        v_item.producto_id, 'botica', v_transferencia.destino_id,
        v_item.cantidad, 0, 0, 0,
        v_transferencia.org_id, NOW()
      );
    END IF;

    -- 3. Obtener datos del lote original (droguería)
    SELECT numero_lote, fecha_vencimiento, proveedor_id
    INTO v_lote_origen
    FROM lotes
    WHERE id = v_item.lote_id;

    IF FOUND THEN
      -- 3a. Buscar si ya existe un lote con el mismo número en la botica destino
      SELECT id, cantidad INTO v_lote_destino
      FROM lotes
      WHERE producto_id = v_item.producto_id
        AND numero_lote = v_lote_origen.numero_lote
        AND ubicacion_tipo = 'botica'
        AND ubicacion_id = v_transferencia.destino_id;

      IF FOUND THEN
        -- Ya existe: sumar cantidad
        UPDATE lotes
        SET cantidad = cantidad + v_item.cantidad
        WHERE id = v_lote_destino.id;
      ELSE
        -- No existe: crear nuevo lote en botica
        INSERT INTO lotes (
          producto_id, ubicacion_tipo, ubicacion_id,
          numero_lote, fecha_vencimiento, cantidad, proveedor_id, org_id
        )
        VALUES (
          v_item.producto_id, 'botica', v_transferencia.destino_id,
          v_lote_origen.numero_lote, v_lote_origen.fecha_vencimiento,
          v_item.cantidad, v_lote_origen.proveedor_id, v_transferencia.org_id
        );
      END IF;
    END IF;

    -- 4. Insertar movimiento de entrada en botica (el trigger lo ignora por transferencia_id)
    INSERT INTO movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, 'botica', v_transferencia.destino_id,
      'entrada', v_item.cantidad, 'Recepción de transferencia desde droguería',
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  -- 5. Actualizar estado de la transferencia
  UPDATE transferencias
  SET estado = 'recibida',
      fecha_recepcion = NOW()
  WHERE id = p_transferencia_id;

  -- 6. Registrar auditoría
  INSERT INTO auditoria (
    org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle
  )
  VALUES (
    v_transferencia.org_id, p_usuario_id, 'RECIBIR_TRANSFERENCIA',
    'transferencias', p_transferencia_id, 'info',
    format(
      'Se confirmó recepción de transferencia — %s producto(s)',
      (SELECT count(*) FROM transferencias_items WHERE transferencia_id = p_transferencia_id)
    )
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'recibida');
END;
$$;

COMMIT;
