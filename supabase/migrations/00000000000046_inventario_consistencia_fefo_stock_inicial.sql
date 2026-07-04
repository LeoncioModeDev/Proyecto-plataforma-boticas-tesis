-- ============================================================
-- Migracion 46: consistencia inventario, FEFO y stock inicial
-- ============================================================

BEGIN;

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Reporte de diferencias entre stock operativo agregado y lotes activos.
CREATE OR REPLACE VIEW public.vw_inconsistencias_stock_lotes
WITH (security_invoker = true) AS
SELECT
  su.org_id,
  su.producto_id,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial AS nombre_producto,
  su.ubicacion_tipo,
  su.ubicacion_id,
  b.codigo_interno AS codigo_ubicacion,
  b.nombre AS nombre_ubicacion,
  su.cantidad_disponible,
  COALESCE(SUM(l.cantidad), 0)::integer AS cantidad_lotes,
  (su.cantidad_disponible - COALESCE(SUM(l.cantidad), 0))::integer AS diferencia
FROM public.stock_ubicaciones su
JOIN public.productos p ON p.id = su.producto_id AND p.org_id = su.org_id
LEFT JOIN public.boticas b ON b.id = su.ubicacion_id AND b.org_id = su.org_id
LEFT JOIN public.lotes l
  ON l.org_id = su.org_id
 AND l.producto_id = su.producto_id
 AND l.ubicacion_tipo = su.ubicacion_tipo
 AND l.ubicacion_id IS NOT DISTINCT FROM su.ubicacion_id
GROUP BY
  su.org_id,
  su.producto_id,
  p.codigo_interno,
  p.nombre_comercial,
  su.ubicacion_tipo,
  su.ubicacion_id,
  b.codigo_interno,
  b.nombre,
  su.cantidad_disponible
HAVING su.cantidad_disponible <> COALESCE(SUM(l.cantidad), 0);

COMMENT ON VIEW public.vw_inconsistencias_stock_lotes IS
  'Reporte operativo para regularizacion manual: diferencias entre stock_ubicaciones.cantidad_disponible y SUM(lotes.cantidad). No corrige stock automaticamente.';

CREATE INDEX IF NOT EXISTS idx_lotes_fefo_asignacion
  ON public.lotes(org_id, producto_id, ubicacion_tipo, ubicacion_id, fecha_vencimiento, created_at, id)
  WHERE cantidad > 0;

-- Seleccion FEFO reutilizable. No modifica stock; solo reserva logicamente la asignacion retornada.
CREATE OR REPLACE FUNCTION public.asignar_lotes_fefo(
  p_org_id uuid,
  p_producto_id uuid,
  p_ubicacion_tipo tipo_ubicacion,
  p_ubicacion_id uuid,
  p_cantidad_requerida integer
)
RETURNS TABLE(
  lote_id uuid,
  numero_lote text,
  fecha_vencimiento date,
  cantidad_disponible integer,
  cantidad_asignada integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote record;
  v_restante integer;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id es obligatorio';
  END IF;

  IF p_cantidad_requerida IS NULL OR p_cantidad_requerida <= 0 THEN
    RAISE EXCEPTION 'La cantidad requerida debe ser mayor a cero';
  END IF;

  v_restante := p_cantidad_requerida;

  FOR v_lote IN
    SELECT l.id, l.numero_lote, l.fecha_vencimiento, l.cantidad
    FROM public.lotes l
    WHERE l.org_id = p_org_id
      AND l.producto_id = p_producto_id
      AND l.ubicacion_tipo = p_ubicacion_tipo
      AND l.ubicacion_id IS NOT DISTINCT FROM p_ubicacion_id
      AND l.cantidad > 0
      AND l.fecha_vencimiento >= (now() AT TIME ZONE 'UTC')::date
    ORDER BY l.fecha_vencimiento ASC, l.created_at ASC, l.id ASC
    FOR UPDATE OF l
  LOOP
    lote_id := v_lote.id;
    numero_lote := v_lote.numero_lote;
    fecha_vencimiento := v_lote.fecha_vencimiento;
    cantidad_disponible := v_lote.cantidad;
    cantidad_asignada := LEAST(v_lote.cantidad, v_restante);
    v_restante := v_restante - cantidad_asignada;
    RETURN NEXT;

    EXIT WHEN v_restante = 0;
  END LOOP;

  IF v_restante > 0 THEN
    RAISE EXCEPTION 'Stock FEFO insuficiente para producto %. Requerido: %, faltante: %',
      p_producto_id, p_cantidad_requerida, v_restante;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.asignar_lotes_fefo(uuid, uuid, tipo_ubicacion, uuid, integer) IS
  'Retorna asignacion FEFO de lotes no vencidos con stock suficiente. No descuenta stock; debe ejecutarse dentro de la transaccion operativa que aplica la salida.';

-- Version corregida: consume stock_minimo/stock_maximo y al reemplazar alinea lotes activos.
CREATE OR REPLACE FUNCTION public.procesar_stock_inicial(
  p_items jsonb,
  p_org_id uuid,
  p_usuario_id uuid,
  p_estrategia text DEFAULT 'reemplazar'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_stock_id uuid;
  v_lote_id uuid;
  v_insertados integer := 0;
  v_actualizados integer := 0;
  v_omitidos integer := 0;
  v_lotes_reemplazados integer := 0;
  v_lotes_afectados integer := 0;
  v_old_stock integer;
  v_stock_minimo integer;
  v_stock_maximo integer;
  v_stock_existe boolean;
  v_diff integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('exito', false, 'error', 'No hay items para procesar');
  END IF;

  IF p_estrategia NOT IN ('reemplazar', 'sumar', 'saltar') THEN
    RETURN jsonb_build_object('exito', false, 'error', 'Estrategia invalida. Use: reemplazar, sumar, saltar');
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      producto_id uuid,
      ubicacion_tipo text,
      ubicacion_id uuid,
      cantidad integer,
      numero_lote text,
      fecha_vencimiento date,
      proveedor_id uuid,
      stock_minimo integer,
      stock_maximo integer
    )
  LOOP
    IF v_item.cantidad IS NULL OR v_item.cantidad < 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para producto %', v_item.producto_id;
    END IF;

    IF v_item.stock_minimo IS NOT NULL AND v_item.stock_minimo < 0 THEN
      RAISE EXCEPTION 'stock_minimo invalido para producto %', v_item.producto_id;
    END IF;

    IF v_item.stock_maximo IS NOT NULL AND v_item.stock_minimo IS NOT NULL AND v_item.stock_maximo < v_item.stock_minimo THEN
      RAISE EXCEPTION 'stock_maximo debe ser mayor o igual a stock_minimo para producto %', v_item.producto_id;
    END IF;

    SELECT id, cantidad_disponible, stock_minimo, stock_maximo
    INTO v_stock_id, v_old_stock, v_stock_minimo, v_stock_maximo
    FROM public.stock_ubicaciones
    WHERE org_id = p_org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_item.ubicacion_tipo::tipo_ubicacion
      AND ubicacion_id IS NOT DISTINCT FROM v_item.ubicacion_id
    FOR UPDATE;

    v_stock_existe := FOUND;

    IF p_estrategia = 'saltar' AND v_stock_existe THEN
      v_omitidos := v_omitidos + 1;
      CONTINUE;
    END IF;

    v_stock_minimo := COALESCE(v_item.stock_minimo, v_stock_minimo, 0);
    v_stock_maximo := COALESCE(v_item.stock_maximo, v_stock_maximo);

    IF NOT v_stock_existe THEN
      INSERT INTO public.stock_ubicaciones (
        org_id,
        producto_id,
        ubicacion_tipo,
        ubicacion_id,
        cantidad_disponible,
        stock_minimo,
        stock_maximo,
        stock_por_recibir,
        stock_en_transito,
        stock_comprometido,
        updated_at
      )
      VALUES (
        p_org_id,
        v_item.producto_id,
        v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        v_item.cantidad,
        v_stock_minimo,
        v_stock_maximo,
        0,
        0,
        0,
        now()
      )
      RETURNING id INTO v_stock_id;

      v_insertados := v_insertados + 1;
      v_old_stock := 0;
      v_diff := v_item.cantidad;
    ELSIF p_estrategia = 'reemplazar' THEN
      v_diff := v_item.cantidad - v_old_stock;

      UPDATE public.stock_ubicaciones
      SET cantidad_disponible = v_item.cantidad,
          stock_minimo = v_stock_minimo,
          stock_maximo = v_stock_maximo,
          updated_at = now()
      WHERE id = v_stock_id;

      UPDATE public.lotes
      SET cantidad = 0
      WHERE org_id = p_org_id
        AND producto_id = v_item.producto_id
        AND ubicacion_tipo = v_item.ubicacion_tipo::tipo_ubicacion
        AND ubicacion_id IS NOT DISTINCT FROM v_item.ubicacion_id
        AND cantidad <> 0;

      GET DIAGNOSTICS v_lotes_afectados = ROW_COUNT;
      v_lotes_reemplazados := v_lotes_reemplazados + v_lotes_afectados;
      v_actualizados := v_actualizados + 1;
    ELSE
      UPDATE public.stock_ubicaciones
      SET cantidad_disponible = cantidad_disponible + v_item.cantidad,
          stock_minimo = v_stock_minimo,
          stock_maximo = v_stock_maximo,
          updated_at = now()
      WHERE id = v_stock_id;

      v_diff := v_item.cantidad;
      v_actualizados := v_actualizados + 1;
    END IF;

    IF v_item.cantidad > 0 THEN
      IF v_item.numero_lote IS NULL OR v_item.fecha_vencimiento IS NULL THEN
        RAISE EXCEPTION 'numero_lote y fecha_vencimiento son obligatorios cuando cantidad > 0';
      END IF;

      INSERT INTO public.lotes (
        producto_id,
        ubicacion_tipo,
        ubicacion_id,
        numero_lote,
        fecha_vencimiento,
        cantidad,
        proveedor_id,
        org_id
      )
      VALUES (
        v_item.producto_id,
        v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        v_item.numero_lote,
        v_item.fecha_vencimiento,
        v_item.cantidad,
        v_item.proveedor_id,
        p_org_id
      )
      ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote)
      DO UPDATE SET
        cantidad = CASE
          WHEN p_estrategia = 'sumar' THEN public.lotes.cantidad + EXCLUDED.cantidad
          ELSE EXCLUDED.cantidad
        END,
        fecha_vencimiento = EXCLUDED.fecha_vencimiento,
        proveedor_id = COALESCE(EXCLUDED.proveedor_id, public.lotes.proveedor_id)
      RETURNING id INTO v_lote_id;
    ELSE
      v_lote_id := NULL;
    END IF;

    IF v_diff <> 0 THEN
      INSERT INTO public.movimientos_inventario (
        producto_id,
        lote_id,
        ubicacion_tipo,
        ubicacion_id,
        tipo_movimiento,
        cantidad,
        motivo,
        usuario_id,
        org_id
      )
      VALUES (
        v_item.producto_id,
        v_lote_id,
        v_item.ubicacion_tipo::tipo_ubicacion,
        v_item.ubicacion_id,
        'ajuste',
        abs(v_diff),
        format('Importacion de stock inicial (%s). Diferencia operativa: %s', p_estrategia, v_diff),
        p_usuario_id,
        p_org_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.auditoria (
    org_id,
    usuario_id,
    accion,
    entidad,
    entidad_id,
    nivel,
    detalle,
    metadata_jsonb
  )
  VALUES (
    p_org_id,
    p_usuario_id,
    'IMPORTAR_STOCK_INICIAL',
    'stock_ubicaciones',
    NULL,
    'info',
    format(
      'Importacion de stock inicial: %s insertados, %s actualizados, %s omitidos (estrategia: %s)',
      v_insertados, v_actualizados, v_omitidos, p_estrategia
    ),
    jsonb_build_object(
      'insertados', v_insertados,
      'actualizados', v_actualizados,
      'omitidos', v_omitidos,
      'lotes_reemplazados', v_lotes_reemplazados,
      'estrategia', p_estrategia
    )
  );

  RETURN jsonb_build_object(
    'exito', true,
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'omitidos', v_omitidos,
    'lotes_reemplazados', v_lotes_reemplazados
  );
END;
$$;

COMMENT ON FUNCTION public.procesar_stock_inicial(jsonb, uuid, uuid, text) IS
  'Procesa stock inicial de forma transaccional. reemplazar alinea stock_ubicaciones y lotes activos; conserva movimientos, auditoria e historial.';

COMMIT;
