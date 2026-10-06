-- ============================================================
-- Migracion 50: recomendaciones operativas, alertas reales y auditoria
-- ============================================================

BEGIN;

ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'stock_critico';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'stock_bajo';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'vencimiento';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'retraso_recepcion';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'retraso_transferencia';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'riesgo_desabastecimiento';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'riesgo_stock_seguridad';
ALTER TYPE public.tipo_alerta ADD VALUE IF NOT EXISTS 'aumento_demanda';
ALTER TYPE public.urgencia_alerta ADD VALUE IF NOT EXISTS 'critica';

ALTER TABLE public.recomendaciones_ml
  ADD COLUMN IF NOT EXISTS orden_compra_id uuid REFERENCES public.ordenes_compra(id),
  ADD COLUMN IF NOT EXISTS stock_libre double precision,
  ADD COLUMN IF NOT EXISTS stock_considerado double precision,
  ADD COLUMN IF NOT EXISTS stock_proyectado double precision,
  ADD COLUMN IF NOT EXISTS metodo_stock_seguridad text,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid REFERENCES public.usuarios(id);

ALTER TABLE public.alertas_ml
  ADD COLUMN IF NOT EXISTS condicion_hash text,
  ADD COLUMN IF NOT EXISTS referencia_tipo text,
  ADD COLUMN IF NOT EXISTS referencia_id uuid,
  ADD COLUMN IF NOT EXISTS resuelta_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS resuelta_en timestamptz,
  ADD COLUMN IF NOT EXISTS comentario_resolucion text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_ml_condicion_abierta_unique
  ON public.alertas_ml(org_id, tipo, producto_id, botica_id, condicion_hash)
  WHERE resuelta = false AND condicion_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.insertar_alerta_unica(
  p_org_id uuid,
  p_tipo public.tipo_alerta,
  p_tipo_origen public.tipo_origen_alerta,
  p_producto_id uuid,
  p_botica_id uuid,
  p_urgencia public.urgencia_alerta,
  p_mensaje text,
  p_condicion_hash text,
  p_referencia_tipo text DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL,
  p_stock_actual integer DEFAULT NULL,
  p_stock_proyectado double precision DEFAULT NULL,
  p_cantidad_recomendada integer DEFAULT NULL,
  p_fecha_vencimiento date DEFAULT NULL,
  p_metadata_jsonb jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerta_id uuid;
BEGIN
  SELECT id INTO v_alerta_id
  FROM public.alertas_ml
  WHERE org_id = p_org_id
    AND tipo = p_tipo
    AND producto_id = p_producto_id
    AND botica_id = p_botica_id
    AND condicion_hash IS NOT DISTINCT FROM p_condicion_hash
    AND resuelta = false
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.alertas_ml
    SET urgencia = p_urgencia,
        mensaje = p_mensaje,
        referencia_tipo = p_referencia_tipo,
        referencia_id = p_referencia_id,
        stock_actual = p_stock_actual,
        stock_proyectado = p_stock_proyectado,
        cantidad_recomendada = p_cantidad_recomendada,
        fecha_vencimiento = p_fecha_vencimiento,
        metadata_jsonb = COALESCE(p_metadata_jsonb, '{}'::jsonb)
    WHERE id = v_alerta_id;
    RETURN v_alerta_id;
  END IF;

  INSERT INTO public.alertas_ml (
    org_id, tipo, tipo_origen, producto_id, botica_id, urgencia, resuelta,
    mensaje, condicion_hash, referencia_tipo, referencia_id, stock_actual,
    stock_proyectado, cantidad_recomendada, fecha_vencimiento, metadata_jsonb
  )
  VALUES (
    p_org_id, p_tipo, p_tipo_origen, p_producto_id, p_botica_id, p_urgencia, false,
    p_mensaje, p_condicion_hash, p_referencia_tipo, p_referencia_id, p_stock_actual,
    p_stock_proyectado, p_cantidad_recomendada, p_fecha_vencimiento, COALESCE(p_metadata_jsonb, '{}'::jsonb)
  )
  RETURNING id INTO v_alerta_id;

  RETURN v_alerta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generar_alertas_organizacion(
  p_org_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock record;
  v_lote record;
  v_oc record;
  v_transferencia record;
  v_rec record;
  v_promedio_4 double precision;
  v_promedio_pred double precision;
  v_total integer := 0;
  v_alerta_id uuid;
  v_urgencia public.urgencia_alerta;
  v_tipo public.tipo_alerta;
  v_dias_vencimiento integer;
  v_drogueria_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id es obligatorio';
  END IF;

  SELECT id INTO v_drogueria_id
  FROM public.boticas
  WHERE org_id = p_org_id AND tipo = 'drogueria' AND activa = true
  ORDER BY created_at, id
  LIMIT 1;

  FOR v_stock IN
    SELECT su.*, p.nombre_comercial, b.nombre AS nombre_botica
    FROM public.stock_ubicaciones su
    JOIN public.productos p ON p.id = su.producto_id AND p.org_id = su.org_id
    LEFT JOIN public.boticas b ON b.id = su.ubicacion_id AND b.org_id = su.org_id
    WHERE su.org_id = p_org_id
      AND su.ubicacion_tipo = 'botica'
      AND su.ubicacion_id IS NOT NULL
  LOOP
    v_tipo := NULL;
    v_urgencia := NULL;

    IF v_stock.cantidad_disponible = 0 THEN
      v_tipo := 'quiebre';
      v_urgencia := 'critica';
    ELSIF v_stock.stock_minimo > 0 AND v_stock.cantidad_disponible <= v_stock.stock_minimo * 0.5 THEN
      v_tipo := 'stock_critico';
      v_urgencia := 'alta';
    ELSIF v_stock.stock_minimo > 0 AND v_stock.cantidad_disponible <= v_stock.stock_minimo THEN
      v_tipo := 'stock_bajo';
      v_urgencia := 'media';
    ELSIF v_stock.stock_maximo IS NOT NULL AND v_stock.cantidad_disponible > v_stock.stock_maximo THEN
      v_tipo := 'sobrestock';
      v_urgencia := 'media';
    END IF;

    IF v_tipo IS NOT NULL THEN
      v_alerta_id := public.insertar_alerta_unica(
        p_org_id, v_tipo, 'regla', v_stock.producto_id, v_stock.ubicacion_id, v_urgencia,
        format('%s en %s: disponible %s, minimo %s, maximo %s', v_stock.nombre_comercial, COALESCE(v_stock.nombre_botica, 'ubicacion'), v_stock.cantidad_disponible, v_stock.stock_minimo, COALESCE(v_stock.stock_maximo::text, 'sin maximo')),
        md5(concat_ws('|', v_tipo::text, v_stock.producto_id::text, v_stock.ubicacion_id::text, v_stock.stock_minimo::text, COALESCE(v_stock.stock_maximo::text, ''))),
        'stock_ubicaciones', v_stock.id, v_stock.cantidad_disponible, NULL, NULL, NULL,
        jsonb_build_object('stock_minimo', v_stock.stock_minimo, 'stock_maximo', v_stock.stock_maximo)
      );
      v_total := v_total + 1;
    END IF;
  END LOOP;

  FOR v_lote IN
    SELECT l.*, p.nombre_comercial, b.nombre AS nombre_botica
    FROM public.lotes l
    JOIN public.productos p ON p.id = l.producto_id AND p.org_id = l.org_id
    LEFT JOIN public.boticas b ON b.id = l.ubicacion_id AND b.org_id = l.org_id
    WHERE l.org_id = p_org_id
      AND l.cantidad > 0
      AND l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '90 days')::date
  LOOP
    v_dias_vencimiento := v_lote.fecha_vencimiento - CURRENT_DATE;
    v_urgencia := CASE
      WHEN v_dias_vencimiento <= 30 THEN 'critica'::public.urgencia_alerta
      WHEN v_dias_vencimiento <= 60 THEN 'alta'::public.urgencia_alerta
      ELSE 'media'::public.urgencia_alerta
    END;

    v_alerta_id := public.insertar_alerta_unica(
      p_org_id, 'vencimiento', 'regla', v_lote.producto_id, COALESCE(v_lote.ubicacion_id, v_drogueria_id), v_urgencia,
      format('Lote %s de %s vence el %s con %s unidades', v_lote.numero_lote, v_lote.nombre_comercial, v_lote.fecha_vencimiento, v_lote.cantidad),
      md5(concat_ws('|', 'vencimiento', v_lote.id::text, v_lote.fecha_vencimiento::text)),
      'lotes', v_lote.id, v_lote.cantidad, NULL, NULL, v_lote.fecha_vencimiento,
      jsonb_build_object('numero_lote', v_lote.numero_lote, 'dias_vencimiento', v_dias_vencimiento)
    );
    v_total := v_total + 1;
  END LOOP;

  FOR v_oc IN
    SELECT oc.id, oc.fecha_estimada_entrega, oci.producto_id, oci.cantidad, p.nombre_comercial
    FROM public.ordenes_compra oc
    JOIN public.ordenes_compra_items oci ON oci.orden_compra_id = oc.id
    JOIN public.productos p ON p.id = oci.producto_id AND p.org_id = oc.org_id
    WHERE oc.org_id = p_org_id
      AND oc.estado IN ('aprobada', 'por_recibir', 'recibida_parcial')
      AND oc.fecha_estimada_entrega < CURRENT_DATE
  LOOP
    v_alerta_id := public.insertar_alerta_unica(
      p_org_id, 'retraso_recepcion', 'regla', v_oc.producto_id, v_drogueria_id, 'alta',
      format('Orden de compra retrasada para %s. Fecha estimada: %s', v_oc.nombre_comercial, v_oc.fecha_estimada_entrega),
      md5(concat_ws('|', 'retraso_recepcion', v_oc.id::text, v_oc.producto_id::text)),
      'ordenes_compra', v_oc.id, NULL, NULL, v_oc.cantidad, NULL,
      jsonb_build_object('fecha_estimada_entrega', v_oc.fecha_estimada_entrega)
    );
    v_total := v_total + 1;
  END LOOP;

  FOR v_transferencia IN
    SELECT t.id, t.destino_id, ti.producto_id, ti.cantidad, p.nombre_comercial, t.fecha_despacho
    FROM public.transferencias t
    JOIN public.transferencias_items ti ON ti.transferencia_id = t.id
    JOIN public.productos p ON p.id = ti.producto_id AND p.org_id = t.org_id
    WHERE t.org_id = p_org_id
      AND t.estado = 'en_transito'
      AND t.fecha_despacho < now() - INTERVAL '3 days'
  LOOP
    v_alerta_id := public.insertar_alerta_unica(
      p_org_id, 'retraso_transferencia', 'regla', v_transferencia.producto_id, v_transferencia.destino_id, 'alta',
      format('Transferencia retrasada para %s. Despachada: %s', v_transferencia.nombre_comercial, v_transferencia.fecha_despacho),
      md5(concat_ws('|', 'retraso_transferencia', v_transferencia.id::text, v_transferencia.producto_id::text)),
      'transferencias', v_transferencia.id, NULL, NULL, v_transferencia.cantidad, NULL,
      jsonb_build_object('fecha_despacho', v_transferencia.fecha_despacho)
    );
    v_total := v_total + 1;
  END LOOP;

  FOR v_rec IN
    SELECT r.*, p.nombre_comercial
    FROM public.recomendaciones_ml r
    JOIN public.productos p ON p.id = r.producto_id AND p.org_id = r.org_id
    WHERE r.org_id = p_org_id
      AND r.estado IN ('pendiente', 'confirmada')
      AND r.stock_proyectado IS NOT NULL
  LOOP
    IF v_rec.stock_proyectado < 0 THEN
      v_alerta_id := public.insertar_alerta_unica(
        p_org_id, 'riesgo_desabastecimiento', 'modelo', v_rec.producto_id, COALESCE(v_rec.botica_destino_id, v_rec.botica_id, v_drogueria_id), 'alta',
        format('Riesgo de desabastecimiento para %s. Stock proyectado: %s', v_rec.nombre_comercial, round(v_rec.stock_proyectado::numeric, 2)),
        md5(concat_ws('|', 'riesgo_desabastecimiento', v_rec.id::text)),
        'recomendaciones_ml', v_rec.id, v_rec.stock_disponible::integer, v_rec.stock_proyectado, v_rec.cantidad_sugerida, NULL,
        jsonb_build_object('stock_seguridad', v_rec.stock_seguridad, 'demanda_durante_lead_time', v_rec.demanda_durante_lead_time)
      );
      v_total := v_total + 1;
    ELSIF v_rec.stock_seguridad IS NOT NULL AND v_rec.stock_proyectado < v_rec.stock_seguridad THEN
      v_alerta_id := public.insertar_alerta_unica(
        p_org_id, 'riesgo_stock_seguridad', 'modelo', v_rec.producto_id, COALESCE(v_rec.botica_destino_id, v_rec.botica_id, v_drogueria_id), 'media',
        format('Stock proyectado bajo seguridad para %s. Proyectado: %s, seguridad: %s', v_rec.nombre_comercial, round(v_rec.stock_proyectado::numeric, 2), round(v_rec.stock_seguridad::numeric, 2)),
        md5(concat_ws('|', 'riesgo_stock_seguridad', v_rec.id::text)),
        'recomendaciones_ml', v_rec.id, v_rec.stock_disponible::integer, v_rec.stock_proyectado, v_rec.cantidad_sugerida, NULL,
        jsonb_build_object('stock_seguridad', v_rec.stock_seguridad, 'demanda_durante_lead_time', v_rec.demanda_durante_lead_time)
      );
      v_total := v_total + 1;
    END IF;
  END LOOP;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (p_org_id, p_usuario_id, 'GENERAR_ALERTAS_ORGANIZACION', 'alertas_ml', NULL, 'info', format('Evaluacion de alertas generada: %s condicion(es)', v_total), jsonb_build_object('total', v_total));

  RETURN jsonb_build_object('exito', true, 'alertas_evaluadas', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_alerta(
  p_alerta_id uuid,
  p_usuario_id uuid,
  p_comentario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerta record;
BEGIN
  SELECT * INTO v_alerta
  FROM public.alertas_ml
  WHERE id = p_alerta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alerta no encontrada: %', p_alerta_id;
  END IF;

  IF v_alerta.resuelta THEN
    RETURN jsonb_build_object('exito', true, 'estado', 'ya_resuelta');
  END IF;

  UPDATE public.alertas_ml
  SET resuelta = true,
      resuelta_por = p_usuario_id,
      resuelta_en = now(),
      comentario_resolucion = p_comentario
  WHERE id = p_alerta_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (v_alerta.org_id, p_usuario_id, 'RESOLVER_ALERTA', 'alertas_ml', p_alerta_id, 'info', COALESCE(p_comentario, 'Alerta resuelta'), jsonb_build_object('tipo', v_alerta.tipo, 'condicion_hash', v_alerta.condicion_hash));

  RETURN jsonb_build_object('exito', true, 'estado', 'resuelta');
END;
$$;

CREATE OR REPLACE FUNCTION public.aprobar_recomendacion_operativa(
  p_recomendacion_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_tipo text;
  v_org_id uuid;
  v_producto_id uuid;
  v_producto_nombre text;
  v_destino_id uuid;
  v_drogueria_id uuid;
  v_proveedor_id uuid;
  v_numero text;
  v_oc_id uuid;
  v_transferencia_id uuid;
  v_cantidad integer;
  v_precio numeric(10,2);
  v_lote record;
  v_restante integer;
  v_stock_origen record;
  v_stock_destino record;
  v_stock_libre double precision;
  v_stock_considerado double precision;
  v_stock_proyectado double precision;
BEGIN
  SELECT r.*, p.nombre_comercial
  INTO v_rec
  FROM public.recomendaciones_ml r
  JOIN public.productos p ON p.id = r.producto_id AND p.org_id = r.org_id
  WHERE r.id = p_recomendacion_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recomendacion no encontrada: %', p_recomendacion_id;
  END IF;

  IF v_rec.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden aprobar recomendaciones pendientes. Estado actual: %', v_rec.estado;
  END IF;

  v_org_id := v_rec.org_id;
  v_producto_id := v_rec.producto_id;
  v_producto_nombre := v_rec.nombre_comercial;
  v_tipo := COALESCE(v_rec.tipo_recomendacion, v_rec.datos_jsonb->>'tipo');
  v_cantidad := GREATEST(CEIL(COALESCE(v_rec.cantidad_final, v_rec.cantidad_sugerida, 0))::integer, 0);

  IF v_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad final de la recomendacion debe ser mayor a cero';
  END IF;

  SELECT id INTO v_drogueria_id
  FROM public.boticas
  WHERE org_id = v_org_id AND tipo = 'drogueria' AND activa = true
  ORDER BY created_at, id
  LIMIT 1;

  IF v_drogueria_id IS NULL THEN
    RAISE EXCEPTION 'No existe drogueria central activa para la organizacion';
  END IF;

  IF v_tipo IN ('COMPRA', 'ORDEN_COMPRA') THEN
    v_proveedor_id := v_rec.proveedor_id;
    IF v_proveedor_id IS NULL THEN
      SELECT proveedor_id INTO v_proveedor_id
      FROM public.proveedor_producto
      WHERE org_id = v_org_id
        AND producto_id = v_producto_id
        AND COALESCE(activo, true)
      ORDER BY lead_time_dias NULLS LAST, precio_referencial NULLS LAST, id
      LIMIT 1;
    END IF;

    IF v_proveedor_id IS NULL THEN
      RAISE EXCEPTION 'No existe proveedor activo para el producto recomendado';
    END IF;

    SELECT public.generar_numero_orden(v_org_id) INTO v_numero;
    v_precio := COALESCE(v_rec.precio_referencial, 0)::numeric(10,2);

    INSERT INTO public.ordenes_compra (
      org_id, numero_orden, proveedor_id, creado_por, estado,
      fecha_estimada_entrega, observaciones
    )
    VALUES (
      v_org_id, v_numero, v_proveedor_id, p_usuario_id, 'pendiente',
      (CURRENT_DATE + COALESCE(v_rec.lead_time_dias, 7)::integer),
      format('Creada desde recomendacion ML %s. %s', p_recomendacion_id, COALESCE(v_rec.motivo, ''))
    )
    RETURNING id INTO v_oc_id;

    INSERT INTO public.ordenes_compra_items (orden_compra_id, producto_id, cantidad, precio_unitario)
    VALUES (v_oc_id, v_producto_id, v_cantidad, v_precio);

    UPDATE public.recomendaciones_ml
    SET estado = 'confirmada',
        confirmado_por = p_usuario_id,
        confirmado_en = now(),
        orden_compra_id = v_oc_id,
        datos_jsonb = COALESCE(datos_jsonb, '{}'::jsonb) || jsonb_build_object('orden_compra_id', v_oc_id, 'numero_orden', v_numero)
    WHERE id = p_recomendacion_id;

    INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
    VALUES (v_org_id, p_usuario_id, 'APROBAR_RECOMENDACION_COMPRA', 'recomendaciones_ml', p_recomendacion_id, 'info', format('Recomendacion aprobada y OC %s creada para %s unidades de %s', v_numero, v_cantidad, v_producto_nombre), jsonb_build_object('orden_compra_id', v_oc_id, 'cantidad', v_cantidad));

    PERFORM public.generar_alertas_organizacion(v_org_id, p_usuario_id);
    RETURN jsonb_build_object('exito', true, 'tipo', 'COMPRA', 'orden_compra_id', v_oc_id, 'numero_orden', v_numero, 'estado', 'confirmada');
  END IF;

  v_destino_id := COALESCE(v_rec.botica_destino_id, v_rec.botica_id);
  IF v_destino_id IS NULL THEN
    RAISE EXCEPTION 'La recomendacion de reposicion no tiene botica destino';
  END IF;
  IF v_destino_id = v_drogueria_id THEN
    RAISE EXCEPTION 'La botica destino no puede ser la drogueria central';
  END IF;

  SELECT cantidad_disponible, stock_comprometido, stock_en_transito, stock_por_recibir
  INTO v_stock_origen
  FROM public.stock_ubicaciones
  WHERE org_id = v_org_id
    AND producto_id = v_producto_id
    AND ubicacion_tipo = 'drogueria'
    AND ubicacion_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe stock de origen en drogueria para el producto';
  END IF;

  v_stock_libre := GREATEST(COALESCE(v_stock_origen.cantidad_disponible, 0) - COALESCE(v_stock_origen.stock_comprometido, 0), 0);
  IF v_stock_libre < v_cantidad THEN
    RAISE EXCEPTION 'Stock libre insuficiente en drogueria. Libre: %, requerido: %', v_stock_libre, v_cantidad;
  END IF;

  v_restante := v_cantidad;
  FOR v_lote IN
    SELECT *
    FROM public.asignar_lotes_fefo(v_org_id, v_producto_id, 'drogueria', NULL, v_cantidad)
  LOOP
    v_restante := v_restante - v_lote.cantidad_asignada;
  END LOOP;

  IF v_restante <> 0 THEN
    RAISE EXCEPTION 'Asignacion FEFO inconsistente para recomendacion %', p_recomendacion_id;
  END IF;

  SELECT public.generar_numero_transferencia(v_org_id) INTO v_numero;

  INSERT INTO public.transferencias (
    tipo_transferencia, numero_transferencia, origen_tipo, origen_id,
    destino_tipo, destino_id, estado, creado_por, observaciones, org_id
  )
  VALUES (
    'transferencia_central', v_numero, 'drogueria', v_drogueria_id,
    'botica', v_destino_id, 'creada', p_usuario_id,
    format('Creada desde recomendacion ML %s. %s', p_recomendacion_id, COALESCE(v_rec.motivo, '')),
    v_org_id
  )
  RETURNING id INTO v_transferencia_id;

  FOR v_lote IN
    SELECT *
    FROM public.asignar_lotes_fefo(v_org_id, v_producto_id, 'drogueria', NULL, v_cantidad)
  LOOP
    INSERT INTO public.transferencias_items (
      transferencia_id, producto_id, lote_id, cantidad, org_id
    )
    VALUES (
      v_transferencia_id, v_producto_id, v_lote.lote_id, v_lote.cantidad_asignada, v_org_id
    );
  END LOOP;

  UPDATE public.recomendaciones_ml
  SET estado = 'confirmada',
      confirmado_por = p_usuario_id,
      confirmado_en = now(),
      transferencia_id = v_transferencia_id,
      botica_origen_id = v_drogueria_id,
      datos_jsonb = COALESCE(datos_jsonb, '{}'::jsonb) || jsonb_build_object('transferencia_id', v_transferencia_id, 'numero_transferencia', v_numero, 'botica_origen_id', v_drogueria_id)
  WHERE id = p_recomendacion_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (v_org_id, p_usuario_id, 'APROBAR_RECOMENDACION_REPOSICION', 'recomendaciones_ml', p_recomendacion_id, 'info', format('Recomendacion aprobada y transferencia %s creada con FEFO para %s unidades de %s', v_numero, v_cantidad, v_producto_nombre), jsonb_build_object('transferencia_id', v_transferencia_id, 'cantidad', v_cantidad));

  PERFORM public.generar_alertas_organizacion(v_org_id, p_usuario_id);
  RETURN jsonb_build_object('exito', true, 'tipo', 'REPOSICION_INTERNA', 'transferencia_id', v_transferencia_id, 'numero_transferencia', v_numero, 'estado', 'confirmada');
END;
$$;

COMMENT ON FUNCTION public.aprobar_recomendacion_operativa(uuid, uuid) IS
  'Aprueba recomendacion ML en una transaccion: compra crea OC; reposicion asigna FEFO y crea transferencia; guarda referencia, audita y genera alertas.';

COMMIT;
