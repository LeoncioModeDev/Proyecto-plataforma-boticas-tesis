-- ============================================================
-- Migracion 51: auditoria operativa y modelo stock_fisico
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Stock operativo: cantidad_disponible pasa a stock_fisico.
--    No se modifica stock_historico ni tablas ML.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_ubicaciones' AND column_name = 'cantidad_disponible'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_ubicaciones' AND column_name = 'stock_fisico'
  ) THEN
    ALTER TABLE public.stock_ubicaciones RENAME COLUMN cantidad_disponible TO stock_fisico;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_ubicaciones' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_ubicaciones' AND column_name = 'modified_at'
  ) THEN
    ALTER TABLE public.stock_ubicaciones RENAME COLUMN updated_at TO modified_at;
  END IF;
END $$;

ALTER TABLE public.stock_ubicaciones
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES public.usuarios(id),
  ALTER COLUMN stock_fisico SET DEFAULT 0,
  ALTER COLUMN stock_fisico SET NOT NULL;

UPDATE public.stock_ubicaciones
SET modified_at = COALESCE(modified_at, created_at, now())
WHERE modified_at IS NULL;

ALTER TABLE public.stock_ubicaciones
  ALTER COLUMN modified_at SET DEFAULT now(),
  ALTER COLUMN modified_at SET NOT NULL;

-- Vista operativa: expone stock_disponible calculado sin persistirlo.
CREATE OR REPLACE VIEW public.vw_stock_operativo
WITH (security_invoker = true) AS
SELECT
  su.*,
  GREATEST(COALESCE(su.stock_fisico, 0) - COALESCE(su.stock_comprometido, 0), 0)::integer AS stock_disponible
FROM public.stock_ubicaciones su;

COMMENT ON VIEW public.vw_stock_operativo IS
  'Vista operativa: stock_disponible = GREATEST(stock_fisico - stock_comprometido, 0). No persistir stock_disponible.';

-- ------------------------------------------------------------
-- 2. Auditoria estandar para tablas operativas/de negocio.
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizaciones', 'usuarios', 'boticas', 'productos', 'categorias_terapeuticas',
    'producto_principio_activo', 'proveedores', 'contactos_proveedor', 'proveedor_producto',
    'precios', 'stock_ubicaciones', 'lotes', 'movimientos_inventario',
    'transferencias', 'transferencias_items', 'ordenes_compra', 'ordenes_compra_items',
    'recepciones_orden', 'recepcion_items', 'configuracion_organizacion',
    'importaciones_datos', 'importaciones_datos_errores', 'ventas_historicas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.usuarios(id)', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS modified_at timestamptz', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES public.usuarios(id)', t);
    EXECUTE format('UPDATE public.%I SET modified_at = COALESCE(modified_at, created_at, now()) WHERE modified_at IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN modified_at SET DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN modified_at SET NOT NULL', t);
  END LOOP;
END $$;

-- Preservar relaciones actuales usuario -> auditoria estandar cuando existen.
UPDATE public.transferencias SET created_by = COALESCE(created_by, creado_por), modified_by = COALESCE(modified_by, creado_por) WHERE creado_por IS NOT NULL;
UPDATE public.ordenes_compra SET created_by = COALESCE(created_by, creado_por), modified_by = COALESCE(modified_by, COALESCE(aprobado_por, creado_por)) WHERE creado_por IS NOT NULL;
UPDATE public.recepciones_orden SET created_by = COALESCE(created_by, registrado_por), modified_by = COALESCE(modified_by, registrado_por) WHERE registrado_por IS NOT NULL;
UPDATE public.movimientos_inventario SET created_by = COALESCE(created_by, usuario_id), modified_by = COALESCE(modified_by, usuario_id) WHERE usuario_id IS NOT NULL;
UPDATE public.importaciones_datos SET created_by = COALESCE(created_by, usuario_id), modified_by = COALESCE(modified_by, usuario_id) WHERE usuario_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_modified_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modified_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizaciones', 'usuarios', 'boticas', 'productos', 'categorias_terapeuticas',
    'producto_principio_activo', 'proveedores', 'contactos_proveedor', 'proveedor_producto',
    'precios', 'stock_ubicaciones', 'lotes', 'movimientos_inventario',
    'transferencias', 'transferencias_items', 'ordenes_compra', 'ordenes_compra_items',
    'recepciones_orden', 'recepcion_items', 'configuracion_organizacion',
    'importaciones_datos', 'importaciones_datos_errores', 'ventas_historicas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_modified_auditoria ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_set_modified_auditoria BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_modified_auditoria()', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Trigger de inventario: stock_fisico es el fisico persistido.
-- ------------------------------------------------------------
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
      stock_fisico, stock_minimo, stock_maximo,
      stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by
    )
    VALUES (
      NEW.org_id, NEW.producto_id, NEW.ubicacion_tipo, NEW.ubicacion_id,
      NEW.cantidad, 0, NULL, 0, 0, 0, NEW.usuario_id, NEW.usuario_id
    )
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET stock_fisico = public.stock_ubicaciones.stock_fisico + EXCLUDED.stock_fisico,
                  stock_por_recibir = GREATEST(public.stock_ubicaciones.stock_por_recibir - EXCLUDED.stock_fisico, 0),
                  modified_by = NEW.usuario_id;

  ELSIF NEW.tipo_movimiento = 'salida' THEN
    SELECT GREATEST(stock_fisico - stock_comprometido, 0) INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock disponible insuficiente para salida. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
    END IF;

    UPDATE public.stock_ubicaciones
    SET stock_fisico = stock_fisico - NEW.cantidad,
        modified_by = NEW.usuario_id
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;

  ELSIF NEW.tipo_movimiento = 'merma' THEN
    SELECT GREATEST(stock_fisico - stock_comprometido, 0) INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock disponible insuficiente para merma. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
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

      UPDATE public.lotes SET cantidad = cantidad - NEW.cantidad, modified_by = NEW.usuario_id WHERE id = NEW.lote_id;
    END IF;

    UPDATE public.stock_ubicaciones
    SET stock_fisico = stock_fisico - NEW.cantidad,
        modified_by = NEW.usuario_id
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;

  ELSIF NEW.tipo_movimiento = 'ajuste' THEN
    IF NEW.direccion_ajuste = 'incremento' THEN
      IF NEW.lote_id IS NOT NULL THEN
        UPDATE public.lotes
        SET cantidad = cantidad + NEW.cantidad,
            modified_by = NEW.usuario_id
        WHERE id = NEW.lote_id
          AND org_id = NEW.org_id
          AND producto_id = NEW.producto_id
          AND ubicacion_tipo = NEW.ubicacion_tipo
          AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Lote no encontrado para el ajuste';
        END IF;
      END IF;

      INSERT INTO public.stock_ubicaciones (
        org_id, producto_id, ubicacion_tipo, ubicacion_id,
        stock_fisico, stock_minimo, stock_maximo,
        stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by
      )
      VALUES (
        NEW.org_id, NEW.producto_id, NEW.ubicacion_tipo, NEW.ubicacion_id,
        NEW.cantidad, 0, NULL, 0, 0, 0, NEW.usuario_id, NEW.usuario_id
      )
      ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET stock_fisico = public.stock_ubicaciones.stock_fisico + EXCLUDED.stock_fisico,
                    modified_by = NEW.usuario_id;

    ELSIF NEW.direccion_ajuste = 'decremento' THEN
      SELECT GREATEST(stock_fisico - stock_comprometido, 0) INTO v_stock_actual
      FROM public.stock_ubicaciones
      WHERE org_id = NEW.org_id
        AND producto_id = NEW.producto_id
        AND ubicacion_tipo = NEW.ubicacion_tipo
        AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
      FOR UPDATE;

      IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock disponible insuficiente para ajuste. Disponible: %, requerido: %', COALESCE(v_stock_actual, 0), NEW.cantidad;
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

        UPDATE public.lotes SET cantidad = cantidad - NEW.cantidad, modified_by = NEW.usuario_id WHERE id = NEW.lote_id;
      END IF;

      UPDATE public.stock_ubicaciones
      SET stock_fisico = stock_fisico - NEW.cantidad,
          modified_by = NEW.usuario_id
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

-- ------------------------------------------------------------
-- 4. Transferencias: stock disponible calculado y stock fisico.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aprobar_transferencia(p_transferencia_id uuid, p_usuario_id uuid)
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
  SELECT * INTO v_transferencia FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id; END IF;
  IF v_transferencia.estado <> 'creada' THEN RAISE EXCEPTION 'Estado invalido: %. Solo se pueden aprobar transferencias en estado creada', v_transferencia.estado; END IF;

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
    IF v_item.lote_org_id <> v_transferencia.org_id THEN RAISE EXCEPTION 'El lote % pertenece a otra organizacion', v_item.lote_id; END IF;
    IF v_item.lote_ubicacion_tipo <> v_transferencia.origen_tipo OR v_item.lote_ubicacion_id IS DISTINCT FROM v_origen_ubicacion_id THEN
      RAISE EXCEPTION 'El lote % no pertenece a la ubicacion origen de la transferencia', v_item.lote_id;
    END IF;
    IF v_item.fecha_vencimiento < (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'El lote % esta vencido y no puede aprobarse', v_item.lote_id; END IF;
    IF v_item.cantidad_lote < v_item.cantidad THEN RAISE EXCEPTION 'Stock insuficiente en lote %. Solicitado %, fisico %', v_item.lote_id, v_item.cantidad, v_item.cantidad_lote; END IF;
  END LOOP;

  FOR v_producto IN
    SELECT producto_id, SUM(cantidad)::integer AS cantidad_total
    FROM public.transferencias_items
    WHERE transferencia_id = p_transferencia_id
    GROUP BY producto_id
  LOOP
    SELECT *, GREATEST(stock_fisico - stock_comprometido, 0) AS stock_disponible INTO v_stock
    FROM public.stock_ubicaciones
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_producto.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'No existe stock operativo para producto % en origen', v_producto.producto_id; END IF;
    IF v_stock.stock_disponible < v_producto.cantidad_total THEN
      RAISE EXCEPTION 'Stock disponible insuficiente para producto %. Requerido %, disponible %', v_producto.producto_id, v_producto.cantidad_total, v_stock.stock_disponible;
    END IF;

    UPDATE public.stock_ubicaciones
    SET stock_comprometido = stock_comprometido + v_producto.cantidad_total,
        modified_by = p_usuario_id
    WHERE id = v_stock.id;
  END LOOP;

  UPDATE public.transferencias_items SET stock_comprometido = true, modified_by = p_usuario_id WHERE transferencia_id = p_transferencia_id;
  UPDATE public.transferencias
  SET estado = 'aprobada', aprobado_por = p_usuario_id, fecha_aprobacion = now(), modified_by = p_usuario_id
  WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_transferencia.org_id, p_usuario_id, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'APROBAR_REDISTRIBUCION' ELSE 'APROBAR_TRANSFERENCIA' END, 'transferencias', p_transferencia_id, 'info', 'Se aprobo transferencia y se comprometio stock');

  RETURN jsonb_build_object('exito', true, 'estado', 'aprobada');
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_transferencia(p_transferencia_id uuid, p_usuario_id uuid)
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
  SELECT * INTO v_transferencia FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id; END IF;
  IF v_transferencia.estado <> 'aprobada' THEN RAISE EXCEPTION 'Estado invalido: %. Solo se pueden despachar transferencias aprobadas', v_transferencia.estado; END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;

  FOR v_item IN SELECT * FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id ORDER BY id LOOP
    UPDATE public.lotes
    SET cantidad = cantidad - v_item.cantidad,
        modified_by = p_usuario_id
    WHERE id = v_item.lote_id
      AND org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
      AND cantidad >= v_item.cantidad;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuficiente o lote invalido al despachar. Lote %, cantidad %', v_item.lote_id, v_item.cantidad; END IF;

    UPDATE public.stock_ubicaciones
    SET stock_fisico = stock_fisico - v_item.cantidad,
        stock_comprometido = stock_comprometido - v_item.cantidad,
        modified_by = p_usuario_id
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.origen_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
      AND stock_fisico >= v_item.cantidad
      AND stock_comprometido >= v_item.cantidad;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock operativo insuficiente o no comprometido para producto %', v_item.producto_id; END IF;

    SELECT id INTO v_stock_destino
    FROM public.stock_ubicaciones
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.destino_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.stock_ubicaciones SET stock_en_transito = stock_en_transito + v_item.cantidad, modified_by = p_usuario_id WHERE id = v_stock_destino.id;
    ELSE
      INSERT INTO public.stock_ubicaciones (org_id, producto_id, ubicacion_tipo, ubicacion_id, stock_fisico, stock_minimo, stock_maximo, stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by)
      VALUES (v_transferencia.org_id, v_item.producto_id, v_transferencia.destino_tipo, v_transferencia.destino_id, 0, 0, NULL, 0, v_item.cantidad, 0, p_usuario_id, p_usuario_id);
    END IF;

    INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, transferencia_id, org_id, created_by, modified_by)
    VALUES (v_item.producto_id, v_item.lote_id, v_transferencia.origen_tipo, v_origen_ubicacion_id, 'salida', v_item.cantidad, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'Despacho de redistribucion' ELSE 'Despacho de transferencia a botica' END, p_usuario_id, p_transferencia_id, v_transferencia.org_id, p_usuario_id, p_usuario_id);
  END LOOP;

  UPDATE public.transferencias_items SET stock_comprometido = false, modified_by = p_usuario_id WHERE transferencia_id = p_transferencia_id;
  UPDATE public.transferencias SET estado = 'en_transito', fecha_despacho = now(), modified_by = p_usuario_id WHERE id = p_transferencia_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_transferencia.org_id, p_usuario_id, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'DESPACHAR_REDISTRIBUCION' ELSE 'DESPACHAR_TRANSFERENCIA' END, 'transferencias', p_transferencia_id, 'info', 'Se despacho transferencia aprobada');

  RETURN jsonb_build_object('exito', true, 'estado', 'en_transito');
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_redistribucion(p_transferencia_id uuid, p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.enviar_transferencia(p_transferencia_id, p_usuario_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_transferencia(p_transferencia_id uuid, p_usuario_id uuid, p_motivo text DEFAULT NULL)
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
  SELECT * INTO v_transferencia FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id; END IF;
  IF v_transferencia.estado NOT IN ('creada', 'aprobada') THEN RAISE EXCEPTION 'Solo se pueden cancelar transferencias creadas o aprobadas. Estado actual: %', v_transferencia.estado; END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;
  IF v_transferencia.estado = 'aprobada' THEN
    FOR v_producto IN SELECT producto_id, SUM(cantidad)::integer AS cantidad_total FROM public.transferencias_items WHERE transferencia_id = p_transferencia_id GROUP BY producto_id LOOP
      UPDATE public.stock_ubicaciones
      SET stock_comprometido = stock_comprometido - v_producto.cantidad_total,
          modified_by = p_usuario_id
      WHERE org_id = v_transferencia.org_id
        AND producto_id = v_producto.producto_id
        AND ubicacion_tipo = v_transferencia.origen_tipo
        AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id
        AND stock_comprometido >= v_producto.cantidad_total;
      IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo liberar stock comprometido para producto %', v_producto.producto_id; END IF;
    END LOOP;
    UPDATE public.transferencias_items SET stock_comprometido = false, modified_by = p_usuario_id WHERE transferencia_id = p_transferencia_id;
  END IF;

  UPDATE public.transferencias SET estado = 'cancelada', observaciones = COALESCE(NULLIF(p_motivo, ''), observaciones, 'Cancelada por el usuario'), modified_by = p_usuario_id WHERE id = p_transferencia_id;
  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_transferencia.org_id, p_usuario_id, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'CANCELAR_REDISTRIBUCION' ELSE 'CANCELAR_TRANSFERENCIA' END, 'transferencias', p_transferencia_id, 'advertencia', format('Se cancelo transferencia. Motivo: %s', COALESCE(NULLIF(p_motivo, ''), 'No especificado')));
  RETURN jsonb_build_object('exito', true, 'estado', 'cancelada');
END;
$$;

CREATE OR REPLACE FUNCTION public.recibir_transferencia(p_transferencia_id uuid, p_usuario_id uuid)
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
  SELECT * INTO v_transferencia FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id; END IF;
  IF v_transferencia.estado <> 'en_transito' THEN RAISE EXCEPTION 'Estado invalido: %. Solo se pueden recibir transferencias en transito', v_transferencia.estado; END IF;

  FOR v_item IN
    SELECT ti.*, l.numero_lote, l.fecha_vencimiento, l.proveedor_id
    FROM public.transferencias_items ti
    JOIN public.lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
  LOOP
    UPDATE public.stock_ubicaciones
    SET stock_en_transito = stock_en_transito - v_item.cantidad,
        stock_fisico = stock_fisico + v_item.cantidad,
        modified_by = p_usuario_id
    WHERE org_id = v_transferencia.org_id
      AND producto_id = v_item.producto_id
      AND ubicacion_tipo = v_transferencia.destino_tipo
      AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id
      AND stock_en_transito >= v_item.cantidad;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock en transito insuficiente para producto %', v_item.producto_id; END IF;

    INSERT INTO public.lotes (org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote, fecha_vencimiento, cantidad, proveedor_id, created_by, modified_by)
    VALUES (v_transferencia.org_id, v_item.producto_id, v_transferencia.destino_tipo, v_transferencia.destino_id, v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad, v_item.proveedor_id, p_usuario_id, p_usuario_id)
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote)
    DO UPDATE SET cantidad = public.lotes.cantidad + EXCLUDED.cantidad,
                  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
                  proveedor_id = COALESCE(EXCLUDED.proveedor_id, public.lotes.proveedor_id),
                  modified_by = p_usuario_id
    RETURNING id INTO v_lote_destino_id;

    INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, transferencia_id, org_id, created_by, modified_by)
    VALUES (v_item.producto_id, v_lote_destino_id, v_transferencia.destino_tipo, v_transferencia.destino_id, 'entrada', v_item.cantidad, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'Recepcion de redistribucion' ELSE 'Recepcion de transferencia' END, p_usuario_id, p_transferencia_id, v_transferencia.org_id, p_usuario_id, p_usuario_id);
  END LOOP;

  UPDATE public.transferencias SET estado = 'recibida', fecha_recepcion = now(), modified_by = p_usuario_id WHERE id = p_transferencia_id;
  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_transferencia.org_id, p_usuario_id, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'RECIBIR_REDISTRIBUCION' ELSE 'RECIBIR_TRANSFERENCIA' END, 'transferencias', p_transferencia_id, 'info', 'Se confirmo recepcion');
  RETURN jsonb_build_object('exito', true, 'estado', 'recibida');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_devolucion_origen(p_transferencia_id uuid, p_usuario_id uuid)
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
  SELECT * INTO v_transferencia FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada: %', p_transferencia_id; END IF;
  IF v_transferencia.estado <> 'pendiente_devolucion' THEN RAISE EXCEPTION 'Estado invalido: %. Solo se puede confirmar devolucion pendiente', v_transferencia.estado; END IF;

  v_origen_ubicacion_id := CASE WHEN v_transferencia.origen_tipo = 'drogueria' THEN NULL ELSE v_transferencia.origen_id END;
  FOR v_item IN
    SELECT ti.*, l.numero_lote, l.fecha_vencimiento, l.proveedor_id
    FROM public.transferencias_items ti
    JOIN public.lotes l ON l.id = ti.lote_id
    WHERE ti.transferencia_id = p_transferencia_id
    ORDER BY ti.id
  LOOP
    UPDATE public.stock_ubicaciones SET stock_en_transito = stock_en_transito - v_item.cantidad, modified_by = p_usuario_id
    WHERE org_id = v_transferencia.org_id AND producto_id = v_item.producto_id AND ubicacion_tipo = v_transferencia.destino_tipo AND ubicacion_id IS NOT DISTINCT FROM v_transferencia.destino_id AND stock_en_transito >= v_item.cantidad;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock en transito insuficiente para devolver producto %', v_item.producto_id; END IF;

    UPDATE public.stock_ubicaciones SET stock_fisico = stock_fisico + v_item.cantidad, modified_by = p_usuario_id
    WHERE org_id = v_transferencia.org_id AND producto_id = v_item.producto_id AND ubicacion_tipo = v_transferencia.origen_tipo AND ubicacion_id IS NOT DISTINCT FROM v_origen_ubicacion_id;
    IF NOT FOUND THEN
      INSERT INTO public.stock_ubicaciones (org_id, producto_id, ubicacion_tipo, ubicacion_id, stock_fisico, stock_minimo, stock_maximo, stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by)
      VALUES (v_transferencia.org_id, v_item.producto_id, v_transferencia.origen_tipo, v_origen_ubicacion_id, v_item.cantidad, 0, NULL, 0, 0, 0, p_usuario_id, p_usuario_id);
    END IF;

    UPDATE public.lotes SET cantidad = cantidad + v_item.cantidad, modified_by = p_usuario_id WHERE id = v_item.lote_id AND org_id = v_transferencia.org_id;
    IF NOT FOUND THEN
      INSERT INTO public.lotes (org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote, fecha_vencimiento, cantidad, proveedor_id, created_by, modified_by)
      VALUES (v_transferencia.org_id, v_item.producto_id, v_transferencia.origen_tipo, v_origen_ubicacion_id, v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad, v_item.proveedor_id, p_usuario_id, p_usuario_id);
    END IF;

    INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, transferencia_id, org_id, created_by, modified_by)
    VALUES (v_item.producto_id, v_item.lote_id, v_transferencia.origen_tipo, v_origen_ubicacion_id, 'devolucion', v_item.cantidad, 'Devolucion fisica confirmada a origen', p_usuario_id, p_transferencia_id, v_transferencia.org_id, p_usuario_id, p_usuario_id);
  END LOOP;

  UPDATE public.transferencias SET estado = 'devuelta_a_origen', fecha_devolucion = now(), modified_by = p_usuario_id WHERE id = p_transferencia_id;
  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_transferencia.org_id, p_usuario_id, CASE WHEN v_transferencia.tipo_transferencia = 'redistribucion' THEN 'CONFIRMAR_DEVOLUCION_REDISTRIBUCION' ELSE 'CONFIRMAR_DEVOLUCION_TRANSFERENCIA' END, 'transferencias', p_transferencia_id, 'info', 'Se confirmo devolucion fisica a origen');
  RETURN jsonb_build_object('exito', true, 'estado', 'devuelta_a_origen');
END;
$$;

-- ------------------------------------------------------------
-- 5. Ordenes de compra: recepcion incrementa stock_fisico.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_orden_por_recibir(p_orden_compra_id uuid, p_usuario_id uuid)
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
  SELECT * INTO v_oc FROM public.ordenes_compra WHERE id = p_orden_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id; END IF;
  IF v_oc.estado <> 'aprobada' THEN RAISE EXCEPTION 'Solo ordenes aprobadas pueden pasar a por_recibir. Estado actual: %', v_oc.estado; END IF;

  FOR v_item IN SELECT * FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id ORDER BY id LOOP
    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido
    FROM public.recepcion_items ri JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id AND COALESCE(r.resultado, '') <> 'en_devolucion' AND ri.producto_id = v_item.producto_id;
    v_pendiente := GREATEST(v_item.cantidad - v_recibido, 0);
    IF v_pendiente = 0 THEN CONTINUE; END IF;

    SELECT id INTO v_stock_id FROM public.stock_ubicaciones WHERE org_id = v_oc.org_id AND producto_id = v_item.producto_id AND ubicacion_tipo = 'drogueria' AND ubicacion_id IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.stock_ubicaciones SET stock_por_recibir = stock_por_recibir + v_pendiente, modified_by = p_usuario_id WHERE id = v_stock_id;
    ELSE
      INSERT INTO public.stock_ubicaciones (org_id, producto_id, ubicacion_tipo, ubicacion_id, stock_fisico, stock_minimo, stock_maximo, stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by)
      VALUES (v_oc.org_id, v_item.producto_id, 'drogueria', NULL, 0, 0, NULL, v_pendiente, 0, 0, p_usuario_id, p_usuario_id);
    END IF;
  END LOOP;

  UPDATE public.ordenes_compra SET estado = 'por_recibir', modified_by = p_usuario_id WHERE id = p_orden_compra_id;
  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (v_oc.org_id, p_usuario_id, 'MARCAR_OC_POR_RECIBIR', 'ordenes_compra', p_orden_compra_id, 'info', 'Orden marcada como por recibir y stock_por_recibir incrementado');
  RETURN jsonb_build_object('exito', true, 'estado', 'por_recibir');
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
  IF p_resultado NOT IN ('recibida', 'recibida_parcial', 'recibida_con_observacion', 'en_devolucion') THEN RAISE EXCEPTION 'resultado invalido: %', p_resultado; END IF;
  SELECT * INTO v_oc FROM public.ordenes_compra WHERE id = p_orden_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden de compra no encontrada: %', p_orden_compra_id; END IF;
  IF v_oc.estado NOT IN ('por_recibir', 'recibida_parcial') THEN RAISE EXCEPTION 'No se puede recibir una orden en estado %', v_oc.estado; END IF;
  SELECT COUNT(*) INTO v_total_items FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id;
  IF v_total_items = 0 THEN RAISE EXCEPTION 'La orden no tiene items'; END IF;
  SELECT public.generar_numero_recepcion(v_oc.org_id) INTO v_numero_recepcion;

  IF p_resultado = 'en_devolucion' THEN
    IF p_motivo_rechazo IS NULL OR btrim(p_motivo_rechazo) = '' THEN RAISE EXCEPTION 'motivo_rechazo es requerido para devolucion'; END IF;
    PERFORM public.cancelar_orden_compra(p_orden_compra_id, p_usuario_id, 'Devolucion: ' || p_motivo_rechazo);
    INSERT INTO public.recepciones_orden (orden_compra_id, org_id, numero_recepcion, resultado, motivo_rechazo, registrado_por, created_by, modified_by)
    VALUES (p_orden_compra_id, v_oc.org_id, v_numero_recepcion, 'en_devolucion', p_motivo_rechazo, p_usuario_id, p_usuario_id, p_usuario_id)
    RETURNING id INTO v_recepcion_id;
    UPDATE public.ordenes_compra SET estado = 'en_devolucion', fecha_real_entrega = NULL, modified_by = p_usuario_id WHERE id = p_orden_compra_id;
    RETURN jsonb_build_object('exito', true, 'estado', 'en_devolucion', 'recepcion_id', v_recepcion_id, 'numero_recepcion', v_numero_recepcion);
  END IF;

  IF p_resultado = 'recibida_con_observacion' AND (p_observacion IS NULL OR btrim(p_observacion) = '') THEN RAISE EXCEPTION 'La observacion es obligatoria para recibida_con_observacion'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Se requiere al menos un item en la recepcion'; END IF;

  CREATE TEMP TABLE tmp_recepcion_oc_items(producto_id uuid PRIMARY KEY, numero_lote text NOT NULL, fecha_vencimiento date NOT NULL, cantidad_recibida integer NOT NULL) ON COMMIT DROP;
  INSERT INTO tmp_recepcion_oc_items(producto_id, numero_lote, fecha_vencimiento, cantidad_recibida)
  SELECT producto_id, numero_lote, fecha_vencimiento, cantidad_recibida
  FROM jsonb_to_recordset(p_items) AS x(producto_id uuid, numero_lote text, fecha_vencimiento date, cantidad_recibida integer);

  FOR v_item IN SELECT * FROM tmp_recepcion_oc_items LOOP
    IF v_item.cantidad_recibida <= 0 THEN RAISE EXCEPTION 'cantidad_recibida debe ser mayor a cero para producto %', v_item.producto_id; END IF;
    IF v_item.fecha_vencimiento < (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'fecha_vencimiento vencida para producto %', v_item.producto_id; END IF;
    SELECT * INTO v_item_oc FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id AND producto_id = v_item.producto_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto % no pertenece a la orden', v_item.producto_id; END IF;
    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido_previo
    FROM public.recepcion_items ri JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id AND COALESCE(r.resultado, '') <> 'en_devolucion' AND ri.producto_id = v_item.producto_id;
    v_pendiente := v_item_oc.cantidad - v_recibido_previo;
    IF v_item.cantidad_recibida > v_pendiente THEN RAISE EXCEPTION 'Producto %: recibido % excede pendiente %', v_item.producto_id, v_item.cantidad_recibida, v_pendiente; END IF;
  END LOOP;

  FOR v_item_oc IN SELECT * FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id LOOP
    SELECT COALESCE(SUM(ri.cantidad_recibida), 0)::integer INTO v_recibido_previo
    FROM public.recepcion_items ri JOIN public.recepciones_orden r ON r.id = ri.recepcion_id
    WHERE r.orden_compra_id = p_orden_compra_id AND COALESCE(r.resultado, '') <> 'en_devolucion' AND ri.producto_id = v_item_oc.producto_id;
    SELECT COALESCE(SUM(t.cantidad_recibida), 0)::integer INTO v_total_recibido FROM tmp_recepcion_oc_items t WHERE t.producto_id = v_item_oc.producto_id;
    IF v_recibido_previo + v_total_recibido < v_item_oc.cantidad THEN v_queda_pendiente := true; END IF;
  END LOOP;
  IF p_resultado = 'recibida_parcial' AND NOT v_queda_pendiente THEN RAISE EXCEPTION 'La recepcion parcial debe dejar saldo pendiente'; END IF;
  IF p_resultado IN ('recibida', 'recibida_con_observacion') AND v_queda_pendiente THEN RAISE EXCEPTION 'Para % no debe quedar saldo pendiente', p_resultado; END IF;

  INSERT INTO public.recepciones_orden (orden_compra_id, org_id, numero_recepcion, resultado, observacion, registrado_por, created_by, modified_by)
  VALUES (p_orden_compra_id, v_oc.org_id, v_numero_recepcion, p_resultado, p_observacion, p_usuario_id, p_usuario_id, p_usuario_id)
  RETURNING id INTO v_recepcion_id;

  FOR v_item IN SELECT * FROM tmp_recepcion_oc_items LOOP
    INSERT INTO public.lotes (org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote, fecha_vencimiento, cantidad, proveedor_id, created_by, modified_by)
    VALUES (v_oc.org_id, v_item.producto_id, 'drogueria', NULL, v_item.numero_lote, v_item.fecha_vencimiento, v_item.cantidad_recibida, v_oc.proveedor_id, p_usuario_id, p_usuario_id)
    ON CONFLICT (org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote)
    DO UPDATE SET cantidad = public.lotes.cantidad + EXCLUDED.cantidad,
                  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
                  proveedor_id = COALESCE(EXCLUDED.proveedor_id, public.lotes.proveedor_id),
                  modified_by = p_usuario_id
    RETURNING id INTO v_lote_id;

    SELECT id INTO v_stock_id FROM public.stock_ubicaciones WHERE org_id = v_oc.org_id AND producto_id = v_item.producto_id AND ubicacion_tipo = 'drogueria' AND ubicacion_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.stock_ubicaciones (org_id, producto_id, ubicacion_tipo, ubicacion_id, stock_fisico, stock_minimo, stock_maximo, stock_por_recibir, stock_en_transito, stock_comprometido, created_by, modified_by)
      VALUES (v_oc.org_id, v_item.producto_id, 'drogueria', NULL, 0, 0, NULL, 0, 0, 0, p_usuario_id, p_usuario_id);
    END IF;

    SELECT cantidad INTO v_pendiente FROM public.ordenes_compra_items WHERE orden_compra_id = p_orden_compra_id AND producto_id = v_item.producto_id;
    INSERT INTO public.recepcion_items (recepcion_id, producto_id, lote_id, cantidad_solicitada, cantidad_recibida, cantidad_devuelta, created_by, modified_by)
    VALUES (v_recepcion_id, v_item.producto_id, v_lote_id, v_pendiente, v_item.cantidad_recibida, 0, p_usuario_id, p_usuario_id);
    INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, org_id, created_by, modified_by)
    VALUES (v_item.producto_id, v_lote_id, 'drogueria', NULL, 'entrada', v_item.cantidad_recibida, format('Recepcion OC %s', p_orden_compra_id), p_usuario_id, v_oc.org_id, p_usuario_id, p_usuario_id);
  END LOOP;

  v_nuevo_estado := CASE WHEN p_resultado = 'recibida_con_observacion' THEN 'recibida_con_observacion' WHEN v_queda_pendiente THEN 'recibida_parcial' ELSE 'recibida' END;
  UPDATE public.ordenes_compra
  SET estado = v_nuevo_estado::public.estado_orden_compra,
      fecha_primera_recepcion = COALESCE(fecha_primera_recepcion, now()),
      fecha_real_entrega = CASE WHEN v_queda_pendiente THEN NULL ELSE (now() AT TIME ZONE 'UTC')::date END,
      modified_by = p_usuario_id
  WHERE id = p_orden_compra_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (v_oc.org_id, p_usuario_id, 'REGISTRAR_RECEPCION_OC', 'recepciones_orden', v_recepcion_id, 'info', format('Recepcion registrada con resultado %s', v_nuevo_estado), jsonb_build_object('orden_compra_id', p_orden_compra_id, 'numero_recepcion', v_numero_recepcion, 'resultado', p_resultado));
  RETURN jsonb_build_object('exito', true, 'estado', v_nuevo_estado, 'recepcion_id', v_recepcion_id, 'numero_recepcion', v_numero_recepcion);
END;
$$;

-- ------------------------------------------------------------
-- 6. Ajustes: validar contra stock_disponible calculado.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. Alertas/recomendaciones operativas: usar stock_disponible.
--    No renombra recomendaciones_ml.stock_libre por compatibilidad ML.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_alertas_organizacion(p_org_id uuid, p_usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock record;
  v_lote record;
  v_total integer := 0;
  v_alerta_id uuid;
  v_urgencia public.urgencia_alerta;
  v_tipo public.tipo_alerta;
  v_dias_vencimiento integer;
  v_drogueria_id uuid;
BEGIN
  IF p_org_id IS NULL THEN RAISE EXCEPTION 'org_id es obligatorio'; END IF;
  SELECT id INTO v_drogueria_id FROM public.boticas WHERE org_id = p_org_id AND tipo = 'drogueria' AND activa = true ORDER BY created_at, id LIMIT 1;

  FOR v_stock IN
    SELECT su.*, p.nombre_comercial, b.nombre AS nombre_botica, GREATEST(su.stock_fisico - su.stock_comprometido, 0) AS stock_disponible
    FROM public.stock_ubicaciones su
    JOIN public.productos p ON p.id = su.producto_id AND p.org_id = su.org_id
    LEFT JOIN public.boticas b ON b.id = su.ubicacion_id AND b.org_id = su.org_id
    WHERE su.org_id = p_org_id AND su.ubicacion_tipo = 'botica' AND su.ubicacion_id IS NOT NULL
  LOOP
    v_tipo := NULL; v_urgencia := NULL;
    IF v_stock.stock_disponible = 0 THEN v_tipo := 'quiebre'; v_urgencia := 'critica';
    ELSIF v_stock.stock_minimo > 0 AND v_stock.stock_disponible <= v_stock.stock_minimo * 0.5 THEN v_tipo := 'stock_critico'; v_urgencia := 'alta';
    ELSIF v_stock.stock_minimo > 0 AND v_stock.stock_disponible <= v_stock.stock_minimo THEN v_tipo := 'stock_bajo'; v_urgencia := 'media';
    ELSIF v_stock.stock_maximo IS NOT NULL AND v_stock.stock_fisico > v_stock.stock_maximo THEN v_tipo := 'sobrestock'; v_urgencia := 'media'; END IF;

    IF v_tipo IS NOT NULL THEN
      v_alerta_id := public.insertar_alerta_unica(
        p_org_id, v_tipo, 'regla', v_stock.producto_id, v_stock.ubicacion_id, v_urgencia,
        format('%s en %s: disponible %s, fisico %s, minimo %s, maximo %s', v_stock.nombre_comercial, COALESCE(v_stock.nombre_botica, 'ubicacion'), v_stock.stock_disponible, v_stock.stock_fisico, v_stock.stock_minimo, COALESCE(v_stock.stock_maximo::text, 'sin maximo')),
        md5(concat_ws('|', v_tipo::text, v_stock.producto_id::text, v_stock.ubicacion_id::text, v_stock.stock_minimo::text, COALESCE(v_stock.stock_maximo::text, ''))),
        'stock_ubicaciones', v_stock.id, v_stock.stock_disponible, NULL, NULL, NULL,
        jsonb_build_object('stock_fisico', v_stock.stock_fisico, 'stock_comprometido', v_stock.stock_comprometido, 'stock_minimo', v_stock.stock_minimo, 'stock_maximo', v_stock.stock_maximo)
      );
      v_total := v_total + 1;
    END IF;
  END LOOP;

  FOR v_lote IN
    SELECT l.*, p.nombre_comercial, b.nombre AS nombre_botica
    FROM public.lotes l
    JOIN public.productos p ON p.id = l.producto_id AND p.org_id = l.org_id
    LEFT JOIN public.boticas b ON b.id = l.ubicacion_id AND b.org_id = l.org_id
    WHERE l.org_id = p_org_id AND l.cantidad > 0 AND l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '90 days')::date
  LOOP
    v_dias_vencimiento := v_lote.fecha_vencimiento - CURRENT_DATE;
    v_urgencia := CASE WHEN v_dias_vencimiento <= 30 THEN 'critica'::public.urgencia_alerta WHEN v_dias_vencimiento <= 60 THEN 'alta'::public.urgencia_alerta ELSE 'media'::public.urgencia_alerta END;
    v_alerta_id := public.insertar_alerta_unica(p_org_id, 'vencimiento', 'regla', v_lote.producto_id, COALESCE(v_lote.ubicacion_id, v_drogueria_id), v_urgencia, format('Lote %s de %s vence el %s con %s unidades', v_lote.numero_lote, v_lote.nombre_comercial, v_lote.fecha_vencimiento, v_lote.cantidad), md5(concat_ws('|', 'vencimiento', v_lote.id::text, v_lote.fecha_vencimiento::text)), 'lotes', v_lote.id, v_lote.cantidad, NULL, NULL, v_lote.fecha_vencimiento, jsonb_build_object('numero_lote', v_lote.numero_lote, 'dias_vencimiento', v_dias_vencimiento));
    v_total := v_total + 1;
  END LOOP;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (p_org_id, p_usuario_id, 'GENERAR_ALERTAS_ORGANIZACION', 'alertas_ml', NULL, 'info', format('Evaluacion de alertas generada: %s condicion(es)', v_total), jsonb_build_object('total', v_total));
  RETURN jsonb_build_object('exito', true, 'alertas_evaluadas', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.aprobar_recomendacion_operativa(p_recomendacion_id uuid, p_usuario_id uuid)
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
  v_stock_disponible double precision;
BEGIN
  SELECT r.*, p.nombre_comercial INTO v_rec
  FROM public.recomendaciones_ml r
  JOIN public.productos p ON p.id = r.producto_id AND p.org_id = r.org_id
  WHERE r.id = p_recomendacion_id
  FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recomendacion no encontrada: %', p_recomendacion_id; END IF;
  IF v_rec.estado <> 'pendiente' THEN RAISE EXCEPTION 'Solo se pueden aprobar recomendaciones pendientes. Estado actual: %', v_rec.estado; END IF;

  v_org_id := v_rec.org_id; v_producto_id := v_rec.producto_id; v_producto_nombre := v_rec.nombre_comercial;
  v_tipo := COALESCE(v_rec.tipo_recomendacion, v_rec.datos_jsonb->>'tipo');
  v_cantidad := GREATEST(CEIL(COALESCE(v_rec.cantidad_final, v_rec.cantidad_sugerida, 0))::integer, 0);
  IF v_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad final de la recomendacion debe ser mayor a cero'; END IF;
  SELECT id INTO v_drogueria_id FROM public.boticas WHERE org_id = v_org_id AND tipo = 'drogueria' AND activa = true ORDER BY created_at, id LIMIT 1;
  IF v_drogueria_id IS NULL THEN RAISE EXCEPTION 'No existe drogueria central activa para la organizacion'; END IF;

  IF v_tipo IN ('COMPRA', 'ORDEN_COMPRA') THEN
    v_proveedor_id := v_rec.proveedor_id;
    IF v_proveedor_id IS NULL THEN
      SELECT proveedor_id INTO v_proveedor_id FROM public.proveedor_producto WHERE org_id = v_org_id AND producto_id = v_producto_id AND COALESCE(activo, true) ORDER BY lead_time_dias NULLS LAST, precio_referencial NULLS LAST, id LIMIT 1;
    END IF;
    IF v_proveedor_id IS NULL THEN RAISE EXCEPTION 'No existe proveedor activo para el producto recomendado'; END IF;
    SELECT public.generar_numero_orden(v_org_id) INTO v_numero;
    v_precio := COALESCE(v_rec.precio_referencial, 0)::numeric(10,2);
    INSERT INTO public.ordenes_compra (org_id, numero_orden, proveedor_id, creado_por, estado, fecha_estimada_entrega, observaciones, created_by, modified_by)
    VALUES (v_org_id, v_numero, v_proveedor_id, p_usuario_id, 'pendiente', (CURRENT_DATE + COALESCE(v_rec.lead_time_dias, 7)::integer), format('Creada desde recomendacion ML %s. %s', p_recomendacion_id, COALESCE(v_rec.motivo, '')), p_usuario_id, p_usuario_id)
    RETURNING id INTO v_oc_id;
    INSERT INTO public.ordenes_compra_items (orden_compra_id, producto_id, cantidad, precio_unitario, created_by, modified_by) VALUES (v_oc_id, v_producto_id, v_cantidad, v_precio, p_usuario_id, p_usuario_id);
    UPDATE public.recomendaciones_ml SET estado = 'confirmada', confirmado_por = p_usuario_id, confirmado_en = now(), orden_compra_id = v_oc_id, datos_jsonb = COALESCE(datos_jsonb, '{}'::jsonb) || jsonb_build_object('orden_compra_id', v_oc_id, 'numero_orden', v_numero) WHERE id = p_recomendacion_id;
    RETURN jsonb_build_object('exito', true, 'tipo', 'COMPRA', 'orden_compra_id', v_oc_id, 'numero_orden', v_numero, 'estado', 'confirmada');
  END IF;

  v_destino_id := COALESCE(v_rec.botica_destino_id, v_rec.botica_id);
  IF v_destino_id IS NULL THEN RAISE EXCEPTION 'La recomendacion de reposicion no tiene botica destino'; END IF;
  IF v_destino_id = v_drogueria_id THEN RAISE EXCEPTION 'La botica destino no puede ser la drogueria central'; END IF;

  SELECT stock_fisico, stock_comprometido, stock_en_transito, stock_por_recibir, GREATEST(stock_fisico - stock_comprometido, 0) AS stock_disponible
  INTO v_stock_origen
  FROM public.stock_ubicaciones
  WHERE org_id = v_org_id AND producto_id = v_producto_id AND ubicacion_tipo = 'drogueria' AND ubicacion_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe stock de origen en drogueria para el producto'; END IF;
  v_stock_disponible := COALESCE(v_stock_origen.stock_disponible, 0);
  IF v_stock_disponible < v_cantidad THEN RAISE EXCEPTION 'Stock disponible insuficiente en drogueria. Disponible: %, requerido: %', v_stock_disponible, v_cantidad; END IF;

  v_restante := v_cantidad;
  FOR v_lote IN SELECT * FROM public.asignar_lotes_fefo(v_org_id, v_producto_id, 'drogueria', NULL, v_cantidad) LOOP
    v_restante := v_restante - v_lote.cantidad_asignada;
  END LOOP;
  IF v_restante <> 0 THEN RAISE EXCEPTION 'Asignacion FEFO inconsistente para recomendacion %', p_recomendacion_id; END IF;
  SELECT public.generar_numero_transferencia(v_org_id) INTO v_numero;

  INSERT INTO public.transferencias (tipo_transferencia, numero_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, observaciones, org_id, created_by, modified_by)
  VALUES ('transferencia_central', v_numero, 'drogueria', v_drogueria_id, 'botica', v_destino_id, 'creada', p_usuario_id, format('Creada desde recomendacion ML %s. %s', p_recomendacion_id, COALESCE(v_rec.motivo, '')), v_org_id, p_usuario_id, p_usuario_id)
  RETURNING id INTO v_transferencia_id;
  FOR v_lote IN SELECT * FROM public.asignar_lotes_fefo(v_org_id, v_producto_id, 'drogueria', NULL, v_cantidad) LOOP
    INSERT INTO public.transferencias_items (transferencia_id, producto_id, lote_id, cantidad, org_id, created_by, modified_by)
    VALUES (v_transferencia_id, v_producto_id, v_lote.lote_id, v_lote.cantidad_asignada, v_org_id, p_usuario_id, p_usuario_id);
  END LOOP;
  UPDATE public.recomendaciones_ml SET estado = 'confirmada', confirmado_por = p_usuario_id, confirmado_en = now(), transferencia_id = v_transferencia_id, botica_origen_id = v_drogueria_id, datos_jsonb = COALESCE(datos_jsonb, '{}'::jsonb) || jsonb_build_object('transferencia_id', v_transferencia_id, 'numero_transferencia', v_numero, 'botica_origen_id', v_drogueria_id) WHERE id = p_recomendacion_id;
  RETURN jsonb_build_object('exito', true, 'tipo', 'REPOSICION_INTERNA', 'transferencia_id', v_transferencia_id, 'numero_transferencia', v_numero, 'estado', 'confirmada');
END;
$$;

-- ------------------------------------------------------------
-- 8. Stock inicial/importaciones y FEFO con stock_fisico.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_lotes_fefo(
  p_org_id uuid,
  p_producto_id uuid,
  p_ubicacion_tipo public.tipo_ubicacion,
  p_ubicacion_id uuid,
  p_cantidad_requerida integer
)
RETURNS TABLE(lote_id uuid, numero_lote text, fecha_vencimiento date, cantidad_disponible integer, cantidad_asignada integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote record;
  v_restante integer := p_cantidad_requerida;
BEGIN
  IF p_cantidad_requerida <= 0 THEN RAISE EXCEPTION 'cantidad debe ser mayor a cero'; END IF;
  FOR v_lote IN
    SELECT l.id, l.numero_lote, l.fecha_vencimiento, l.cantidad
    FROM public.lotes l
    WHERE l.org_id = p_org_id
      AND l.producto_id = p_producto_id
      AND l.ubicacion_tipo = p_ubicacion_tipo
      AND l.ubicacion_id IS NOT DISTINCT FROM CASE WHEN p_ubicacion_tipo = 'drogueria' THEN NULL ELSE p_ubicacion_id END
      AND l.cantidad > 0
      AND l.fecha_vencimiento >= (now() AT TIME ZONE 'UTC')::date
    ORDER BY l.fecha_vencimiento ASC, l.created_at ASC, l.id ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    lote_id := v_lote.id;
    numero_lote := v_lote.numero_lote;
    fecha_vencimiento := v_lote.fecha_vencimiento;
    cantidad_disponible := v_lote.cantidad;
    cantidad_asignada := LEAST(v_lote.cantidad, v_restante);
    v_restante := v_restante - cantidad_asignada;
    RETURN NEXT;
  END LOOP;
  IF v_restante > 0 THEN RAISE EXCEPTION 'Stock insuficiente para FEFO. Faltante: %', v_restante; END IF;
END;
$$;

COMMIT;
