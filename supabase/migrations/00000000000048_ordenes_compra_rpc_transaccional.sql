-- ============================================================
-- Migracion 48: RPC transaccionales para ordenes de compra
-- ============================================================

BEGIN;

ALTER TABLE public.ordenes_compra
  ADD COLUMN IF NOT EXISTS fecha_primera_recepcion timestamptz;

CREATE OR REPLACE FUNCTION public.aprobar_orden_compra(
  p_orden_compra_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc record;
BEGIN
  SELECT * INTO v_oc
  FROM public.ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id;
  END IF;

  IF v_oc.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden aprobar ordenes pendientes. Estado actual: %', v_oc.estado;
  END IF;

  UPDATE public.ordenes_compra
  SET estado = 'aprobada',
      aprobado_por = p_usuario_id,
      fecha_aprobacion = now()
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_oc.org_id, p_usuario_id, 'APROBAR_ORDEN_COMPRA', 'ordenes_compra', p_orden_compra_id, 'info', 'Orden de compra aprobada');

  RETURN jsonb_build_object('exito', true, 'estado', 'aprobada');
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_orden_por_recibir(
  p_orden_compra_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc record;
  v_item record;
  v_recibido integer;
  v_pendiente integer;
  v_stock_id uuid;
BEGIN
  SELECT * INTO v_oc
  FROM public.ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id;
  END IF;

  IF v_oc.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo ordenes aprobadas pueden pasar a por_recibir. Estado actual: %', v_oc.estado;
  END IF;

  FOR v_item IN
    SELECT * FROM public.ordenes_compra_items
    WHERE orden_compra_id = p_orden_compra_id
    ORDER BY id
  LOOP
    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido
    FROM public.recepcion_items ri
    JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id
      AND COALESCE(r.resultado, '') <> 'en_devolucion'
      AND ri.producto_id = v_item.producto_id;

    v_pendiente := GREATEST(v_item.cantidad - v_recibido, 0);
    IF v_pendiente = 0 THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_stock_id
    FROM public.stock_ubicaciones
    WHERE org_id = v_oc.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = 'drogueria'
      AND ubicacion_id IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.stock_ubicaciones
      SET stock_por_recibir = stock_por_recibir + v_pendiente,
          updated_at = now()
      WHERE id = v_stock_id;
    ELSE
      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
      )
      VALUES (v_oc.org_id, v_item.producto_id, 'drogueria', NULL, 0, 0, NULL, v_pendiente, 0, 0, now());
    END IF;
  END LOOP;

  UPDATE public.ordenes_compra
  SET estado = 'por_recibir'
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_oc.org_id, p_usuario_id, 'MARCAR_OC_POR_RECIBIR', 'ordenes_compra', p_orden_compra_id, 'info', 'Orden marcada como por recibir y stock_por_recibir incrementado');

  RETURN jsonb_build_object('exito', true, 'estado', 'por_recibir');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_orden_compra(
  p_orden_compra_id uuid,
  p_usuario_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc record;
  v_item record;
  v_recibido integer;
  v_pendiente integer;
BEGIN
  SELECT * INTO v_oc
  FROM public.ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id;
  END IF;

  IF v_oc.estado NOT IN ('aprobada', 'por_recibir', 'recibida_parcial') THEN
    RAISE EXCEPTION 'No se puede cancelar una orden en estado %', v_oc.estado;
  END IF;

  IF v_oc.estado IN ('por_recibir', 'recibida_parcial') THEN
    FOR v_item IN
      SELECT * FROM public.ordenes_compra_items
      WHERE orden_compra_id = p_orden_compra_id
    LOOP
      SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido
      FROM public.recepcion_items ri
      JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
      WHERE r.orden_compra_id = p_orden_compra_id
        AND COALESCE(r.resultado, '') <> 'en_devolucion'
        AND ri.producto_id = v_item.producto_id;

      v_pendiente := GREATEST(v_item.cantidad - v_recibido, 0);
      IF v_pendiente > 0 THEN
        UPDATE public.stock_ubicaciones
        SET stock_por_recibir = GREATEST(stock_por_recibir - v_pendiente, 0),
            updated_at = now()
        WHERE org_id = v_oc.org_id
          AND producto_id = v_item.producto_id
          AND ubicacion_tipo = 'drogueria'
          AND ubicacion_id IS NULL;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.ordenes_compra
  SET estado = 'cancelada',
      cancelado_por = p_usuario_id,
      fecha_cancelacion = now(),
      motivo_cancelacion = p_motivo
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_oc.org_id, p_usuario_id, 'CANCELAR_ORDEN_COMPRA', 'ordenes_compra', p_orden_compra_id, 'advertencia', format('Orden cancelada. Motivo: %s', COALESCE(NULLIF(p_motivo, ''), 'No especificado')));

  RETURN jsonb_build_object('exito', true, 'estado', 'cancelada');
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_orden_compra(
  p_orden_compra_id uuid,
  p_usuario_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc record;
BEGIN
  SELECT * INTO v_oc
  FROM public.ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id;
  END IF;

  IF v_oc.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden rechazar ordenes pendientes. Estado actual: %', v_oc.estado;
  END IF;

  UPDATE public.ordenes_compra
  SET estado = 'rechazada',
      rechazado_por = p_usuario_id,
      fecha_rechazo = now(),
      motivo_rechazo = p_motivo
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_oc.org_id, p_usuario_id, 'RECHAZAR_ORDEN_COMPRA', 'ordenes_compra', p_orden_compra_id, 'advertencia', format('Orden rechazada. Motivo: %s', COALESCE(NULLIF(p_motivo, ''), 'No especificado')));

  RETURN jsonb_build_object('exito', true, 'estado', 'rechazada');
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_recepcion_orden_compra(
  p_orden_compra_id uuid,
  p_usuario_id uuid,
  p_resultado text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_observacion text DEFAULT NULL,
  p_motivo_rechazo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc record;
  v_item record;
  v_item_oc record;
  v_recibido_previo integer;
  v_pendiente integer;
  v_total_recibido integer;
  v_queda_pendiente boolean := false;
  v_numero_recepcion text;
  v_recepcion_id uuid;
  v_lote_id uuid;
  v_stock_id uuid;
  v_nuevo_estado text;
  v_total_items integer;
BEGIN
  IF p_resultado NOT IN ('recibida', 'recibida_parcial', 'recibida_con_observacion', 'en_devolucion') THEN
    RAISE EXCEPTION 'resultado invalido: %', p_resultado;
  END IF;

  SELECT * INTO v_oc
  FROM public.ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id;
  END IF;

  IF v_oc.estado NOT IN ('por_recibir', 'recibida_parcial') THEN
    RAISE EXCEPTION 'No se puede recibir una orden en estado %', v_oc.estado;
  END IF;

  SELECT COUNT(*) INTO v_total_items FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id;
  IF v_total_items = 0 THEN
    RAISE EXCEPTION 'La orden no tiene items';
  END IF;

  SELECT public.generar_numero_recepcion(v_oc.org_id) INTO v_numero_recepcion;

  IF p_resultado = 'en_devolucion' THEN
    IF p_motivo_rechazo IS NULL OR btrim(p_motivo_rechazo) = '' THEN
      RAISE EXCEPTION 'motivo_rechazo es requerido para devolucion';
    END IF;

    PERFORM public.cancelar_orden_compra(p_orden_compra_id, p_usuario_id, 'Devolucion: ' || p_motivo_rechazo);

    INSERT INTO public.recepciones_orden (
      orden_compra_id, org_id, numero_recepcion, resultado, motivo_rechazo, registrado_por
    )
    VALUES (p_orden_compra_id, v_oc.org_id, v_numero_recepcion, 'en_devolucion', p_motivo_rechazo, p_usuario_id)
    RETURNING id INTO v_recepcion_id;

    UPDATE public.ordenes_compra
    SET estado = 'en_devolucion',
        fecha_real_entrega = NULL
    WHERE id = p_orden_compra_id;

    INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
    VALUES (v_oc.org_id, p_usuario_id, 'OC_EN_DEVOLUCION', 'ordenes_compra', p_orden_compra_id, 'advertencia', format('Orden enviada a devolucion. Motivo: %s', p_motivo_rechazo));

    RETURN jsonb_build_object('exito', true, 'estado', 'en_devolucion', 'recepcion_id', v_recepcion_id, 'numero_recepcion', v_numero_recepcion);
  END IF;

  IF p_resultado = 'recibida_con_observacion' AND (p_observacion IS NULL OR btrim(p_observacion) = '') THEN
    RAISE EXCEPTION 'La observacion es obligatoria para recibida_con_observacion';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Se requiere al menos un item en la recepcion';
  END IF;

  CREATE TEMP TABLE tmp_recepcion_oc_items(
    producto_id uuid PRIMARY KEY,
    numero_lote text NOT NULL,
    fecha_vencimiento date NOT NULL,
    cantidad_recibida integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_recepcion_oc_items(producto_id, numero_lote, fecha_vencimiento, cantidad_recibida)
  SELECT producto_id, numero_lote, fecha_vencimiento, cantidad_recibida
  FROM jsonb_to_recordset(p_items) AS x(
    producto_id uuid,
    numero_lote text,
    fecha_vencimiento date,
    cantidad_recibida integer
  );

  FOR v_item IN SELECT * FROM tmp_recepcion_oc_items LOOP
    IF v_item.cantidad_recibida <= 0 THEN
      RAISE EXCEPTION 'cantidad_recibida debe ser mayor a cero para producto %', v_item.producto_id;
    END IF;
    IF v_item.fecha_vencimiento < (now() AT TIME ZONE 'UTC')::date THEN
      RAISE EXCEPTION 'fecha_vencimiento vencida para producto %', v_item.producto_id;
    END IF;

    SELECT * INTO v_item_oc
    FROM public.ordenes_compra_items
    WHERE orden_compra_id = p_orden_compra_id
      AND producto_id = v_item.producto_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no pertenece a la orden', v_item.producto_id;
    END IF;

    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido_previo
    FROM public.recepcion_items ri
    JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id
      AND COALESCE(r.resultado, '') <> 'en_devolucion'
      AND ri.producto_id = v_item.producto_id;

    v_pendiente := v_item_oc.cantidad - v_recibido_previo;
    IF v_item.cantidad_recibida > v_pendiente THEN
      RAISE EXCEPTION 'Producto %: recibido % excede pendiente %', v_item.producto_id, v_item.cantidad_recibida, v_pendiente;
    END IF;
  END LOOP;

  FOR v_item_oc IN SELECT * FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id LOOP
    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido_previo
    FROM public.recepcion_items ri
    JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id
      AND COALESCE(r.resultado, '') <> 'en_devolucion'
      AND ri.producto_id = v_item_oc.producto_id;

    SELECT COALESCE(SUM(t.cantidad_recibida), 0)::integer INTO v_total_recibido
    FROM tmp_recepcion_oc_items t
    WHERE t.producto_id = v_item_oc.producto_id;

    IF v_recibido_previo + v_total_recibido < v_item_oc.cantidad THEN
      v_queda_pendiente := true;
    END IF;
  END LOOP;

  IF p_resultado = 'recibida_parcial' AND NOT v_queda_pendiente THEN
    RAISE EXCEPTION 'La recepcion parcial debe dejar saldo pendiente';
  END IF;
  IF p_resultado IN ('recibida', 'recibida_con_observacion') AND v_queda_pendiente THEN
    RAISE EXCEPTION 'Para % no debe quedar saldo pendiente', p_resultado;
  END IF;

  INSERT INTO public.recepciones_orden (
    orden_compra_id, org_id, numero_recepcion, resultado, observacion, registrado_por
  )
  VALUES (p_orden_compra_id, v_oc.org_id, v_numero_recepcion, p_resultado, p_observacion, p_usuario_id)
  RETURNING id INTO v_recepcion_id;

  FOR v_item IN SELECT * FROM tmp_recepcion_oc_items LOOP
    INSERT INTO public.lotes (
      org_id, producto_id, ubicacion_tipo, ubicacion_id,
      numero_lote, fecha_vencimiento, cantidad, proveedor_id
    )
    VALUES (
      v_oc.org_id, v_item.producto_id, 'drogueria', NULL,
      v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad_recibida, v_oc.proveedor_id
    )
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote)
    DO UPDATE SET cantidad = public.lotes.cantidad + EXCLUDED.cantidad,
                  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
                  proveedor_id = COALESCE(EXCLUDED.proveedor_id, public.lotes.proveedor_id)
    RETURNING id INTO v_lote_id;

    SELECT id INTO v_stock_id
    FROM public.stock_ubicaciones
    WHERE org_id = v_oc.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = 'drogueria'
      AND ubicacion_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
      )
      VALUES (v_oc.org_id, v_item.producto_id, 'drogueria', NULL, 0, 0, NULL, 0, 0, 0, now());
    END IF;

    SELECT cantidad INTO v_pendiente
    FROM public.ordenes_compra_items
    WHERE orden_compra_id = p_orden_compra_id
      AND producto_id = v_item.producto_id;

    INSERT INTO public.recepcion_items (
      recepcion_id, producto_id, lote_id, cantidad_solicitada, cantidad_recibida, cantidad_devuelta
    )
    VALUES (v_recepcion_id, v_item.producto_id, v_lote_id, v_pendiente, v_item.cantidad_recibida, 0);

    INSERT INTO public.movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id, org_id
    )
    VALUES (
      v_item.producto_id, v_lote_id, 'drogueria', NULL,
      'entrada', v_item.cantidad_recibida, format('Recepcion OC %s', p_orden_compra_id), p_usuario_id, v_oc.org_id
    );
  END LOOP;

  v_nuevo_estado := CASE
    WHEN p_resultado = 'recibida_con_observacion' THEN 'recibida_con_observacion'
    WHEN v_queda_pendiente THEN 'recibida_parcial'
    ELSE 'recibida'
  END;

  UPDATE public.ordenes_compra
  SET estado = v_nuevo_estado::public.estado_orden_compra,
      fecha_primera_recepcion = COALESCE(fecha_primera_recepcion, now()),
      fecha_real_entrega = CASE WHEN v_queda_pendiente THEN NULL ELSE (now() AT TIME ZONE 'UTC')::date END
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (
    v_oc.org_id, p_usuario_id, 'REGISTRAR_RECEPCION_OC', 'recepciones_orden', v_recepcion_id, 'info',
    format('Recepcion registrada con resultado %s', v_nuevo_estado),
    jsonb_build_object('orden_compra_id', p_orden_compra_id, 'numero_recepcion', v_numero_recepcion, 'resultado', p_resultado)
  );

  RETURN jsonb_build_object('exito', true, 'estado', v_nuevo_estado, 'recepcion_id', v_recepcion_id, 'numero_recepcion', v_numero_recepcion);
END;
$$;

COMMENT ON FUNCTION public.registrar_recepcion_orden_compra(uuid, uuid, text, jsonb, text, text) IS
  'Registra recepcion de OC en una unica transaccion: recepcion, items, lotes, movimiento, stock via trigger, estado y auditoria.';

COMMIT;
