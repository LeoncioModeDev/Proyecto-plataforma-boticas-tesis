-- ============================================================
-- Migracion 47: flujo objetivo de transferencias y redistribuciones
-- ============================================================

BEGIN;

ALTER TYPE public.estado_transferencia ADD VALUE IF NOT EXISTS 'aprobada';

ALTER TABLE public.transferencias
  ADD COLUMN IF NOT EXISTS aprobado_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_devolucion timestamptz;

ALTER TABLE public.transferencias_items
  ADD COLUMN IF NOT EXISTS stock_comprometido boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.aprobar_transferencia(
  p_transferencia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transferencia record;
  v_item record;
  v_producto record;
  v_origen_ubicacion_id uuid;
  v_stock record;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado <> 'creada' THEN
    RAISE EXCEPTION 'Estado invalido: %. Solo se pueden aprobar transferencias en estado creada', v_transferencia.estado;
  END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;

  FOR v_item IN
    SELECT ti.*, l.cantidad AS cantidad_lote, l.ubicacion_tipo AS lote_ubicacion_tipo, l.ubicacion_id AS lote_ubicacion_id,
           l.org_id AS lote_org_id, l.fecha_vencimiento
    FROM public.transferencias_items ti
    JOIN public.lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
    FOR UPDATE OF l
  LOOP
    IF v_item.lote_org_id <> v_transferencia.org_id THEN
      RAISE EXCEPTION 'El lote % pertenece a otra organizacion', v_item.lote_id;
    END IF;

    IF v_item.lote_ubicacion_tipo <> v_transferencia.origen_tipo
       OR v_item.lote_ubicacion_id IS DISTINCT FROM v_origen_ubicacion_id THEN
      RAISE EXCEPTION 'El lote % no pertenece a la ubicacion origen de la transferencia', v_item.lote_id;
    END IF;

    IF v_item.fecha_vencimiento < (now() AT TIME ZONE 'UTC')::date THEN
      RAISE EXCEPTION 'El lote % esta vencido y no puede aprobarse', v_item.lote_id;
    END IF;

    IF v_item.cantidad_lote < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en lote %. Solicitado %, disponible %', v_item.lote_id, v_item.cantidad, v_item.cantidad_lote;
    END IF;
  END LOOP;

  FOR v_producto IN
    SELECT producto_id, SUM(cantidad)::integer AS cantidad_total
    FROM public.transferencias_items
    WHERE transferencia_id = p_transferencia_id
    GROUP BY producto_id
  LOOP
    SELECT * INTO v_stock
    FROM public.stock_ubicaciones
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_producto.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe stock operativo para producto % en origen', v_producto.producto_id;
    END IF;

    IF GREATEST(v_stock.cantidad_disponible - v_stock.stock_comprometido, 0) < v_producto.cantidad_total THEN
      RAISE EXCEPTION 'Stock libre insuficiente para producto %. Requerido %, libre %',
        v_producto.producto_id,
        v_producto.cantidad_total,
        GREATEST(v_stock.cantidad_disponible - v_stock.stock_comprometido, 0);
    END IF;

    UPDATE public.stock_ubicaciones
    SET stock_comprometido = stock_comprometido + v_producto.cantidad_total,
        updated_at = now()
    WHERE id = v_stock.id;
  END LOOP;

  UPDATE public.transferencias_items
  SET stock_comprometido = true
  WHERE transferencia_id = p_transferencia_id;

  UPDATE public.transferencias
  SET estado = 'aprobada',
      aprobado_por = p_usuario_id,
      fecha_aprobacion = now()
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'APROBAR_REDISTRIBUCION' ELSE 'APROBAR_TRANSFERENCIA' END,
    'transferencias',
    p_transferencia_id,
    'info',
    format('Se aprobo transferencia y se comprometio stock de %s item(s)', (SELECT count(*) FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id))
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'aprobada');
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_transferencia(
  p_transferencia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_transferencia record;
  v_origen_ubicacion_id uuid;
  v_stock_destino record;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Estado invalido: %. Solo se pueden despachar transferencias aprobadas', v_transferencia.estado;
  END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;

  FOR v_item IN
    SELECT * FROM public.transferencias_items
    WHERE transferencia_id = p_transferencia_id
    ORDER BY id
  LOOP
    UPDATE public.lotes
    SET cantidad = cantidad - v_item.cantidad
    WHERE id = v_item.lote_id
      AND org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
      AND cantidad >= v_item.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente o lote invalido al despachar. Lote %, cantidad %', v_item.lote_id, v_item.cantidad;
    END IF;

    UPDATE public.stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible - v_item.cantidad,
        stock_comprometido = stock_comprometido - v_item.cantidad,
        updated_at = now()
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
      AND cantidad_disponible >= v_item.cantidad
      AND stock_comprometido >= v_item.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock operativo insuficiente o no comprometido para producto %', v_item.producto_id;
    END IF;

    SELECT id INTO v_stock_destino
    FROM public.stock_ubicaciones
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.destino_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.stock_ubicaciones
      SET stock_en_transito = stock_en_transito + v_item.cantidad,
          updated_at = now()
      WHERE id = v_stock_destino.id;
    ELSE
      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
      )
      VALUES (
        v_transferencia.org_id, v_item.producto_id, v_transferencia.destino_tipo, v_transferencia.destino_id,
        0, 0, NULL, 0, v_item.cantidad, 0, now()
      );
    END IF;

    INSERT INTO public.movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, v_transferencia.origen_tipo, v_origen_ubicacion_id,
      'salida', v_item.cantidad,
      CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'Despacho de redistribucion' ELSE 'Despacho de transferencia a botica' END,
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  UPDATE public.transferencias_items
  SET stock_comprometido = false
  WHERE transferencia_id = p_transferencia_id;

  UPDATE public.transferencias
  SET estado = 'en_transito',
      fecha_despacho = now()
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'DESPACHAR_REDISTRIBUCION' ELSE 'DESPACHAR_TRANSFERENCIA' END,
    'transferencias', p_transferencia_id, 'info',
    format('Se despacho transferencia aprobada con %s item(s)', (SELECT count(*) FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id))
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'en_transito');
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_redistribucion(
  p_transferencia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.enviar_transferencia(p_transferencia_id, p_usuario_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_transferencia(
  p_transferencia_id uuid,
  p_usuario_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transferencia record;
  v_producto record;
  v_origen_ubicacion_id uuid;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado NOT IN ('creada', 'aprobada') THEN
    RAISE EXCEPTION 'Solo se pueden cancelar transferencias creadas o aprobadas. Estado actual: %', v_transferencia.estado;
  END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;

  IF v_transferencia.estado = 'aprobada' THEN
    FOR v_producto IN
      SELECT producto_id, SUM(cantidad)::integer AS cantidad_total
      FROM public.transferencias_items
      WHERE transferencia_id = p_transferencia_id
      GROUP BY producto_id
    LOOP
      UPDATE public.stock_ubicaciones
      SET stock_comprometido = stock_comprometido - v_producto.cantidad_total,
          updated_at = now()
      WHERE org_id = v_transferencia.org_id
        AND producto_id = v_producto.producto_id
        AND ubicacion_tipo = v_transferencia.origen_tipo
        AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
        AND stock_comprometido >= v_producto.cantidad_total;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo liberar stock comprometido para producto %', v_producto.producto_id;
      END IF;
    END LOOP;

    UPDATE public.transferencias_items
    SET stock_comprometido = false
    WHERE transferencia_id = p_transferencia_id;
  END IF;

  UPDATE public.transferencias
  SET estado = 'cancelada',
      observaciones = COALESCE(NULLIF(p_motivo, ''), observaciones, 'Cancelada por el usuario')
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'CANCELAR_REDISTRIBUCION' ELSE 'CANCELAR_TRANSFERENCIA' END,
    'transferencias', p_transferencia_id, 'advertencia',
    format('Se cancelo transferencia. Motivo: %s', COALESCE(NULLIF(p_motivo, ''), 'No especificado'))
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'cancelada');
END;
$$;

CREATE OR REPLACE FUNCTION public.recibir_transferencia(
  p_transferencia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_transferencia record;
  v_lote_destino_id uuid;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado <> 'en_transito' THEN
    RAISE EXCEPTION 'Estado invalido: %. Solo se pueden recibir transferencias en transito', v_transferencia.estado;
  END IF;

  FOR v_item IN
    SELECT ti.*, l.numero_lote, l.fecha_vencimiento, l.proveedor_id
    FROM public.transferencias_items ti
    JOIN public.lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
  LOOP
    UPDATE public.stock_ubicaciones
    SET stock_en_transito = stock_en_transito - v_item.cantidad,
        cantidad_disponible = cantidad_disponible + v_item.cantidad,
        updated_at = now()
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.destino_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id
      AND stock_en_transito >= v_item.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock en transito insuficiente para producto %', v_item.producto_id;
    END IF;

    INSERT INTO public.lotes (
      org_id, producto_id, ubicacion_tipo, ubicacion_id,
      numero_lote, fecha_vencimiento, cantidad, proveedor_id
    )
    VALUES (
      v_transferencia.org_id, v_item.producto_id, v_transferencia.destino_tipo, v_transferencia.destino_id,
      v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad, v_item.proveedor_id
    )
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote)
    DO UPDATE SET cantidad = public.lotes.cantidad + EXCLUDED.cantidad,
                  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
                  proveedor_id = COALESCE(EXCLUDED.proveedor_id, public.lotes.proveedor_id)
    RETURNING id INTO v_lote_destino_id;

    INSERT INTO public.movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_lote_destino_id, v_transferencia.destino_tipo, v_transferencia.destino_id,
      'entrada', v_item.cantidad,
      CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'Recepcion de redistribucion' ELSE 'Recepcion de transferencia' END,
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  UPDATE public.transferencias
  SET estado = 'recibida',
      fecha_recepcion = now()
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'RECIBIR_REDISTRIBUCION' ELSE 'RECIBIR_TRANSFERENCIA' END,
    'transferencias', p_transferencia_id, 'info',
    format('Se confirmo recepcion con %s item(s)', (SELECT count(*) FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id))
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'recibida');
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_transferencia(
  p_transferencia_id uuid,
  p_usuario_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transferencia record;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado <> 'en_transito' THEN
    RAISE EXCEPTION 'Estado invalido: %. Solo se pueden rechazar transferencias en transito', v_transferencia.estado;
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
  END IF;

  UPDATE public.transferencias
  SET estado = 'pendiente_devolucion',
      motivo_rechazo = p_motivo
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'RECHAZAR_REDISTRIBUCION' ELSE 'RECHAZAR_TRANSFERENCIA' END,
    'transferencias', p_transferencia_id, 'advertencia',
    format('Destino rechazo transferencia. Queda pendiente de devolucion. Motivo: %s', p_motivo)
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'pendiente_devolucion');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_devolucion_origen(
  p_transferencia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_transferencia record;
  v_origen_ubicacion_id uuid;
BEGIN
  SELECT * INTO v_transferencia
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id;
  END IF;

  IF v_transferencia.estado <> 'pendiente_devolucion' THEN
    RAISE EXCEPTION 'Estado invalido: %. Solo se puede confirmar devolucion pendiente', v_transferencia.estado;
  END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;

  FOR v_item IN
    SELECT ti.*, l.numero_lote, l.fecha_vencimiento, l.proveedor_id
    FROM public.transferencias_items ti
    JOIN public.lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
  LOOP
    UPDATE public.stock_ubicaciones
    SET stock_en_transito = stock_en_transito - v_item.cantidad,
        updated_at = now()
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.destino_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id
      AND stock_en_transito >= v_item.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock en transito insuficiente para devolver producto %', v_item.producto_id;
    END IF;

    UPDATE public.stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
        updated_at = now()
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id;

    IF NOT FOUND THEN
      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
      )
      VALUES (
        v_transferencia.org_id, v_item.producto_id, v_transferencia.origen_tipo, v_origen_ubicacion_id,
        v_item.cantidad, 0, NULL, 0, 0, 0, now()
      );
    END IF;

    UPDATE public.lotes
    SET cantidad = cantidad + v_item.cantidad
    WHERE id = v_item.lote_id
      AND org_id = v_transferencia.org_id;

    IF NOT FOUND THEN
      INSERT INTO public.lotes (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        numero_lote, fecha_vencimiento, cantidad, proveedor_id
      )
      VALUES (
        v_transferencia.org_id, v_item.producto_id, v_transferencia.origen_tipo, v_origen_ubicacion_id,
        v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad, v_item.proveedor_id
      );
    END IF;

    INSERT INTO public.movimientos_inventario (
      producto_id, lote_id, ubicacion_tipo, ubicacion_id,
      tipo_movimiento, cantidad, motivo, usuario_id,
      transferencia_id, org_id
    )
    VALUES (
      v_item.producto_id, v_item.lote_id, v_transferencia.origen_tipo, v_origen_ubicacion_id,
      'devolucion', v_item.cantidad, 'Devolucion fisica confirmada a origen',
      p_usuario_id, p_transferencia_id, v_transferencia.org_id
    );
  END LOOP;

  UPDATE public.transferencias
  SET estado = 'devuelta_a_origen',
      fecha_devolucion = now()
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    v_transferencia.org_id,
    p_usuario_id,
    CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'CONFIRMAR_DEVOLUCION_REDISTRIBUCION' ELSE 'CONFIRMAR_DEVOLUCION_TRANSFERENCIA' END,
    'transferencias', p_transferencia_id, 'info',
    format('Se confirmo devolucion fisica a origen con %s item(s)', (SELECT count(*) FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id))
  );

  RETURN jsonb_build_object('exito', true, 'estado', 'devuelta_a_origen');
END;
$$;

CREATE OR REPLACE VIEW public.vw_transferencias_rechazadas_regularizacion
WITH (security_invoker = true) AS
SELECT
  t.org_id,
  t.id AS transferencia_id,
  t.numero_transferencia,
  t.tipo_transferencia,
  t.origen_tipo,
  t.origen_id,
  t.destino_tipo,
  t.destino_id,
  t.estado,
  t.motivo_rechazo,
  t.fecha_recepcion,
  t.created_at,
  COUNT(ti.id) AS items,
  SUM(ti.cantidad) AS cantidad_total
FROM public.transferencias t
LEFT JOIN public.transferencias_items ti ON ti.transferencia_id = t.id
WHERE t.estado = 'rechazada'
GROUP BY t.org_id, t.id, t.numero_transferencia, t.tipo_transferencia, t.origen_tipo, t.origen_id,
         t.destino_tipo, t.destino_id, t.estado, t.motivo_rechazo, t.fecha_recepcion, t.created_at;

COMMENT ON VIEW public.vw_transferencias_rechazadas_regularizacion IS
  'Reporte de transferencias historicas rechazadas para regularizacion manual. No modifica stock automaticamente.';

COMMIT;
