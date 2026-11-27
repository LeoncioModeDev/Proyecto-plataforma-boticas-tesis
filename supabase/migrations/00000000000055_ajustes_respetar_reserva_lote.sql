BEGIN;

CREATE INDEX IF NOT EXISTS idx_transferencias_items_reserva_lote
  ON public.transferencias_items (org_id, lote_id)
  WHERE stock_comprometido;

CREATE OR REPLACE FUNCTION public.registrar_ajuste_inventario(
  p_org_id uuid,
  p_usuario_id uuid,
  p_producto_id uuid,
  p_lote_id uuid,
  p_ubicacion_tipo public.tipo_ubicacion,
  p_ubicacion_id uuid,
  p_tipo_movimiento text,
  p_direccion_ajuste text,
  p_cantidad integer,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote record;
  v_stock_disponible integer;
  v_reserva_lote bigint;
  v_movimiento_id uuid;
  v_accion text;
  v_ubicacion_id_normalizada uuid;
BEGIN
  IF p_org_id IS NULL THEN RAISE EXCEPTION 'org_id es obligatorio'; END IF;
  IF p_usuario_id IS NULL THEN RAISE EXCEPTION 'usuario_id es obligatorio'; END IF;
  IF p_producto_id IS NULL THEN RAISE EXCEPTION 'producto_id es obligatorio'; END IF;
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote_id es obligatorio'; END IF;
  IF p_ubicacion_tipo IS NULL THEN RAISE EXCEPTION 'ubicacion_tipo es obligatorio'; END IF;
  IF p_ubicacion_tipo <> 'drogueria' AND p_ubicacion_id IS NULL THEN RAISE EXCEPTION 'ubicacion_id es obligatorio para boticas'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad debe ser mayor a 0'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN RAISE EXCEPTION 'motivo debe tener al menos 10 caracteres'; END IF;
  IF p_tipo_movimiento NOT IN ('ajuste', 'merma') THEN RAISE EXCEPTION 'tipo_movimiento debe ser ajuste o merma'; END IF;
  IF p_tipo_movimiento = 'ajuste' AND p_direccion_ajuste NOT IN ('incremento', 'decremento') THEN RAISE EXCEPTION 'direccion_ajuste debe ser incremento o decremento'; END IF;
  IF p_tipo_movimiento = 'merma' AND p_direccion_ajuste IS NOT NULL THEN RAISE EXCEPTION 'direccion_ajuste debe ser nulo para merma'; END IF;

  v_ubicacion_id_normalizada := CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END;

  PERFORM 1 FROM public.productos WHERE id = p_producto_id AND org_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado en la organizacion'; END IF;

  -- Aprobacion y despacho ya toman lote antes que stock. No invertir solo este RPC.
  SELECT id, cantidad INTO v_lote
  FROM public.lotes
  WHERE id = p_lote_id
    AND org_id = p_org_id
    AND producto_id = p_producto_id
    AND ubicacion_tipo = p_ubicacion_tipo
    AND ubicacion_id IS NOT DISTINCT FROM v_ubicacion_id_normalizada
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado para producto y ubicacion indicados'; END IF;

  IF p_tipo_movimiento = 'merma' OR p_direccion_ajuste = 'decremento' THEN
    IF v_lote.cantidad < p_cantidad THEN RAISE EXCEPTION 'Cantidad solicitada (%) excede la disponible en lote (%)', p_cantidad, v_lote.cantidad; END IF;
    SELECT GREATEST(stock_fisico - stock_comprometido, 0) INTO v_stock_disponible
    FROM public.stock_ubicaciones
    WHERE org_id = p_org_id AND producto_id = p_producto_id AND ubicacion_tipo = p_ubicacion_tipo AND ubicacion_id IS NOT DISTINCT FROM v_ubicacion_id_normalizada
    FOR UPDATE;
    IF NOT FOUND OR v_stock_disponible < p_cantidad THEN RAISE EXCEPTION 'Cantidad solicitada (%) excede el stock disponible (%)', p_cantidad, COALESCE(v_stock_disponible, 0); END IF;

    -- Leer despues de ambos locks: cancelar libera la reserva bajo el lock de stock.
    -- No bloquear cabeceras ni items, pues las transiciones toman primero la cabecera.
    SELECT COALESCE(SUM(ti.cantidad), 0) INTO v_reserva_lote
    FROM public.transferencias_items ti
    JOIN public.transferencias t ON t.id = ti.transferencia_id AND t.org_id = ti.org_id
    WHERE ti.org_id = p_org_id AND ti.producto_id = p_producto_id AND ti.lote_id = p_lote_id
      AND ti.stock_comprometido AND t.estado = 'aprobada'
      AND t.origen_tipo = p_ubicacion_tipo
      AND (CASE WHEN t.origen_tipo = 'drogueria' THEN NULL ELSE t.origen_id END)
          IS NOT DISTINCT FROM v_ubicacion_id_normalizada;

    IF v_lote.cantidad - v_reserva_lote < p_cantidad THEN
      RAISE EXCEPTION 'Cantidad solicitada (%) excede el stock no comprometido del lote (%)',
        p_cantidad, GREATEST(v_lote.cantidad - v_reserva_lote, 0);
    END IF;
  END IF;

  INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, direccion_ajuste, cantidad, motivo, usuario_id, org_id, created_by, modified_by)
  VALUES (p_producto_id, p_lote_id, p_ubicacion_tipo, v_ubicacion_id_normalizada, p_tipo_movimiento::public.tipo_movimiento, CASE WHEN p_tipo_movimiento = 'ajuste' THEN p_direccion_ajuste ELSE NULL END, p_cantidad, trim(p_motivo), p_usuario_id, p_org_id, p_usuario_id, p_usuario_id)
  RETURNING id INTO v_movimiento_id;

  v_accion := CASE WHEN p_tipo_movimiento = 'merma' THEN 'REGISTRAR_MERMA' ELSE 'REGISTRAR_AJUSTE_INVENTARIO' END;
  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (p_org_id, p_usuario_id, v_accion, 'movimientos_inventario', v_movimiento_id, CASE WHEN p_tipo_movimiento = 'merma' THEN 'advertencia' ELSE 'info' END, trim(p_motivo), jsonb_build_object('producto_id', p_producto_id, 'lote_id', p_lote_id, 'ubicacion_tipo', p_ubicacion_tipo, 'ubicacion_id', v_ubicacion_id_normalizada, 'tipo_movimiento', p_tipo_movimiento, 'direccion_ajuste', CASE WHEN p_tipo_movimiento = 'ajuste' THEN p_direccion_ajuste ELSE NULL END, 'cantidad', p_cantidad));
  RETURN jsonb_build_object('exito', true, 'movimiento_id', v_movimiento_id);
END;
$$;

COMMIT;
