-- ============================================================
-- Migracion 49: ajustes y mermas transaccionales
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.actualizar_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_actual integer;
  v_lote_actual integer;
BEGIN
  -- Los movimientos de transferencia son aplicados por sus RPCs operativas.
  IF NEW.transferencia_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo_movimiento IN ('entrada', 'devolucion') THEN
    INSERT INTO public.stock_ubicaciones (
      org_id, producto_id, ubicacion_tipo, ubicacion_id,
      cantidad_disponible, stock_minimo, stock_maximo,
      stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
    )
    VALUES (
      NEW.org_id, NEW.producto_id, NEW.ubicacion_tipo, NEW.ubicacion_id,
      NEW.cantidad, 0, NULL, 0, 0, 0, now()
    )
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET cantidad_disponible = public.stock_ubicaciones.cantidad_disponible + EXCLUDED.cantidad_disponible,
                  stock_por_recibir = GREATEST(public.stock_ubicaciones.stock_por_recibir - EXCLUDED.cantidad_disponible, 0),
                  updated_at = now();

  ELSIF NEW.tipo_movimiento = 'salida' THEN
    SELECT cantidad_disponible INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para salida. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
    END IF;

    UPDATE public.stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
        updated_at = now()
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;

  ELSIF NEW.tipo_movimiento = 'merma' THEN
    SELECT cantidad_disponible INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para merma. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
    END IF;

    IF NEW.lote_id IS NOT NULL THEN
      SELECT cantidad INTO v_lote_actual
      FROM public.lotes
      WHERE id = NEW.lote_id
        AND org_id = NEW.org_id
        AND producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
      FOR UPDATE;

      IF NOT FOUND OR v_lote_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en lote para merma. Disponible: %, requerido: %', COALESCE(v_lote_actual, 0), NEW.cantidad;
      END IF;

      UPDATE public.lotes
      SET cantidad = cantidad - NEW.cantidad
      WHERE id = NEW.lote_id;
    END IF;

    UPDATE public.stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
        updated_at = now()
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;

  ELSIF NEW.tipo_movimiento = 'ajuste' THEN
    IF NEW.direccion_ajuste = 'incremento' THEN
      IF NEW.lote_id IS NOT NULL THEN
        PERFORM 1
        FROM public.lotes
        WHERE id = NEW.lote_id
          AND org_id = NEW.org_id
          AND producto_id = NEW.producto_id
          AND ubicacion_tipo = NEW.ubicacion_tipo
          AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Lote no encontrado para el ajuste';
        END IF;

        UPDATE public.lotes
        SET cantidad = cantidad + NEW.cantidad
        WHERE id = NEW.lote_id;
      END IF;

      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        cantidad_disponible, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, updated_at
      )
      VALUES (
        NEW.org_id, NEW.producto_id, NEW.ubicacion_tipo, NEW.ubicacion_id,
        NEW.cantidad, 0, NULL, 0, 0, 0, now()
      )
      ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET cantidad_disponible = public.stock_ubicaciones.cantidad_disponible + EXCLUDED.cantidad_disponible,
                    updated_at = now();

    ELSIF NEW.direccion_ajuste = 'decremento' THEN
      SELECT cantidad_disponible INTO v_stock_actual
      FROM public.stock_ubicaciones
      WHERE org_id = NEW.org_id
        AND producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
      FOR UPDATE;

      IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para ajuste. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
      END IF;

      IF NEW.lote_id IS NOT NULL THEN
        SELECT cantidad INTO v_lote_actual
        FROM public.lotes
        WHERE id = NEW.lote_id
          AND org_id = NEW.org_id
          AND producto_id = NEW.producto_id
          AND ubicacion_tipo = NEW.ubicacion_tipo
          AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
        FOR UPDATE;

        IF NOT FOUND OR v_lote_actual < NEW.cantidad THEN
          RAISE EXCEPTION 'Stock insuficiente en lote para ajuste. Disponible: %, requerido: %', COALESCE(v_lote_actual, 0), NEW.cantidad;
        END IF;

        UPDATE public.lotes
        SET cantidad = cantidad - NEW.cantidad
        WHERE id = NEW.lote_id;
      END IF;

      UPDATE public.stock_ubicaciones
      SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
          updated_at = now()
      WHERE org_id = NEW.org_id
        AND producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_stock ON public.movimientos_inventario;
CREATE TRIGGER trg_actualizar_stock
AFTER INSERT ON public.movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION public.actualizar_stock();

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
  v_stock_actual integer;
  v_movimiento_id uuid;
  v_accion text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id es obligatorio';
  END IF;

  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'usuario_id es obligatorio';
  END IF;

  IF p_producto_id IS NULL THEN
    RAISE EXCEPTION 'producto_id es obligatorio';
  END IF;

  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'lote_id es obligatorio';
  END IF;

  IF p_ubicacion_tipo IS NULL THEN
    RAISE EXCEPTION 'ubicacion_tipo es obligatorio';
  END IF;

  IF p_ubicacion_tipo <> 'drogueria' AND p_ubicacion_id IS NULL THEN
    RAISE EXCEPTION 'ubicacion_id es obligatorio para boticas';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad debe ser mayor a 0';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 10 caracteres';
  END IF;

  IF p_tipo_movimiento NOT IN ('ajuste', 'merma') THEN
    RAISE EXCEPTION 'tipo_movimiento debe ser ajuste o merma';
  END IF;

  IF p_tipo_movimiento = 'ajuste' AND p_direccion_ajuste NOT IN ('incremento', 'decremento') THEN
    RAISE EXCEPTION 'direccion_ajuste debe ser incremento o decremento';
  END IF;

  IF p_tipo_movimiento = 'merma' AND p_direccion_ajuste IS NOT NULL THEN
    RAISE EXCEPTION 'direccion_ajuste debe ser nulo para merma';
  END IF;

  PERFORM 1
  FROM public.productos
  WHERE id = p_producto_id
    AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en la organizacion';
  END IF;

  SELECT id, cantidad
  INTO v_lote
  FROM public.lotes
  WHERE id = p_lote_id
    AND org_id = p_org_id
    AND producto_id = p_producto_id
    AND ubicacion_tipo = p_ubicacion_tipo
    AND ubicacion_id IS NOT DISTINCT FROM CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado para producto y ubicacion indicados';
  END IF;

  IF p_tipo_movimiento = 'merma' OR p_direccion_ajuste = 'decremento' THEN
    IF v_lote.cantidad < p_cantidad THEN
      RAISE EXCEPTION 'Cantidad solicitada (%) excede la disponible en lote (%)', p_cantidad, v_lote.cantidad;
    END IF;

    SELECT cantidad_disponible INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = p_org_id
      AND producto_id = p_producto_id
      AND ubicacion_tipo = p_ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Cantidad solicitada (%) excede el stock disponible (%)', p_cantidad, COALESCE(v_stock_actual, 0);
    END IF;
  END IF;

  INSERT INTO public.movimientos_inventario (
    producto_id,
    lote_id,
    ubicacion_tipo,
    ubicacion_id,
    tipo_movimiento,
    direccion_ajuste,
    cantidad,
    motivo,
    usuario_id,
    org_id
  )
  VALUES (
    p_producto_id,
    p_lote_id,
    p_ubicacion_tipo,
    CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END,
    p_tipo_movimiento::public.tipo_movimiento,
    CASE WHEN p_tipo_movimiento = 'ajuste' THEN p_direccion_ajuste ELSE NULL END,
    p_cantidad,
    trim(p_motivo),
    p_usuario_id,
    p_org_id
  )
  RETURNING id INTO v_movimiento_id;

  v_accion := CASE WHEN p_tipo_movimiento = 'merma' THEN 'REGISTRAR_MERMA' ELSE 'REGISTRAR_AJUSTE_INVENTARIO' END;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (
    p_org_id,
    p_usuario_id,
    v_accion,
    'movimientos_inventario',
    v_movimiento_id,
    CASE WHEN p_tipo_movimiento = 'merma' THEN 'advertencia' ELSE 'info' END,
    trim(p_motivo),
    jsonb_build_object(
      'producto_id', p_producto_id,
      'lote_id', p_lote_id,
      'ubicacion_tipo', p_ubicacion_tipo,
      'ubicacion_id', CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END,
      'tipo_movimiento', p_tipo_movimiento,
      'direccion_ajuste', CASE WHEN p_tipo_movimiento = 'ajuste' THEN p_direccion_ajuste ELSE NULL END,
      'cantidad', p_cantidad
    )
  );

  RETURN jsonb_build_object('exito', true, 'movimiento_id', v_movimiento_id);
END;
$$;

COMMENT ON FUNCTION public.registrar_ajuste_inventario(uuid, uuid, uuid, uuid, public.tipo_ubicacion, uuid, text, text, integer, text) IS
  'Registra ajustes y mermas en una transaccion: valida org/producto/lote/stock, inserta movimiento, actualiza stock/lote via trigger y audita.';

COMMIT;
