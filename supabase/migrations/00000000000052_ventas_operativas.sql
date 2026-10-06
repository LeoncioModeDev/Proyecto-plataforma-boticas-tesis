-- ============================================================
-- Migracion 52: ventas operativas transaccionales
-- ============================================================
-- Convencion de precios para ventas operativas:
-- precios.precio_venta y venta_items.precio_unitario representan precio final
-- unitario con IGV incluido. En ventas: total = suma(importe_total),
-- subtotal = total / 1.18, igv = total - subtotal.
-- ventas_historicas permanece exclusivamente para datos importados.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tipos de movimiento para ventas operativas
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'tipo_movimiento' AND e.enumlabel = 'venta'
  ) THEN
    ALTER TYPE public.tipo_movimiento ADD VALUE 'venta';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'tipo_movimiento' AND e.enumlabel = 'anulacion_venta'
  ) THEN
    ALTER TYPE public.tipo_movimiento ADD VALUE 'anulacion_venta';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Tablas operativas de ventas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizaciones(id),
  botica_id uuid NOT NULL REFERENCES public.boticas(id),
  numero_venta text NOT NULL,
  fecha_venta timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid NOT NULL REFERENCES public.usuarios(id),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  igv numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'registrada',
  resultado_atencion text NOT NULL DEFAULT 'no_atendida',
  clave_idempotencia text NOT NULL,
  motivo_anulacion text,
  anulado_por uuid REFERENCES public.usuarios(id),
  anulado_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id),
  modified_at timestamptz NOT NULL DEFAULT now(),
  modified_by uuid REFERENCES public.usuarios(id),
  CONSTRAINT chk_ventas_estado CHECK (estado IN ('registrada', 'anulada')),
  CONSTRAINT chk_ventas_resultado CHECK (resultado_atencion IN ('completa', 'parcial', 'no_atendida')),
  CONSTRAINT chk_ventas_totales_no_negativos CHECK (subtotal >= 0 AND igv >= 0 AND total >= 0),
  CONSTRAINT chk_ventas_anulacion_consistente CHECK (
    (estado = 'anulada' AND motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_en IS NOT NULL)
    OR estado = 'registrada'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_numero_org ON public.ventas(org_id, numero_venta);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_idempotencia_org ON public.ventas(org_id, clave_idempotencia);
CREATE INDEX IF NOT EXISTS idx_ventas_org_fecha ON public.ventas(org_id, fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_botica_fecha ON public.ventas(botica_id, fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON public.ventas(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_ventas_resultado ON public.ventas(org_id, resultado_atencion);

CREATE TABLE IF NOT EXISTS public.venta_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE RESTRICT,
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  cantidad_solicitada integer NOT NULL,
  cantidad_atendida integer NOT NULL,
  demanda_no_atendida integer GENERATED ALWAYS AS (cantidad_solicitada - cantidad_atendida) STORED,
  precio_unitario numeric(10,2) NOT NULL,
  importe_total numeric(12,2) NOT NULL,
  motivo_no_atencion text,
  detalle_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id),
  modified_at timestamptz NOT NULL DEFAULT now(),
  modified_by uuid REFERENCES public.usuarios(id),
  CONSTRAINT chk_venta_items_cantidad_solicitada CHECK (cantidad_solicitada > 0),
  CONSTRAINT chk_venta_items_cantidad_atendida CHECK (cantidad_atendida >= 0 AND cantidad_atendida <= cantidad_solicitada),
  CONSTRAINT chk_venta_items_precio CHECK (precio_unitario >= 0 AND importe_total >= 0),
  CONSTRAINT chk_venta_items_motivo CHECK (
    cantidad_atendida = cantidad_solicitada
    OR motivo_no_atencion IN ('stock_insuficiente', 'sin_stock', 'otro')
  ),
  CONSTRAINT chk_venta_items_otro_detalle CHECK (motivo_no_atencion <> 'otro' OR length(trim(COALESCE(detalle_motivo, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON public.venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON public.venta_items(producto_id);

CREATE TABLE IF NOT EXISTS public.venta_item_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_item_id uuid NOT NULL REFERENCES public.venta_items(id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id),
  modified_at timestamptz NOT NULL DEFAULT now(),
  modified_by uuid REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_venta_item_lotes_item ON public.venta_item_lotes(venta_item_id);
CREATE INDEX IF NOT EXISTS idx_venta_item_lotes_lote ON public.venta_item_lotes(lote_id);

COMMENT ON TABLE public.ventas IS 'Ventas operativas transaccionales. No reemplaza ventas_historicas importadas.';
COMMENT ON COLUMN public.venta_items.precio_unitario IS 'Precio final unitario con IGV incluido, copiado desde precios.precio_venta al momento de la venta.';
COMMENT ON COLUMN public.venta_items.importe_total IS 'Importe final con IGV incluido: cantidad_atendida * precio_unitario.';
COMMENT ON COLUMN public.venta_items.demanda_no_atendida IS 'Generada por base de datos: cantidad_solicitada - cantidad_atendida.';

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES public.ventas(id),
  ADD COLUMN IF NOT EXISTS venta_item_id uuid REFERENCES public.venta_items(id);

CREATE INDEX IF NOT EXISTS idx_movimientos_venta ON public.movimientos_inventario(venta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_venta_item ON public.movimientos_inventario(venta_item_id);

-- Auditoria estandar para nuevas tablas.
DROP TRIGGER IF EXISTS trg_ventas_set_modified_auditoria ON public.ventas;
CREATE TRIGGER trg_ventas_set_modified_auditoria BEFORE UPDATE ON public.ventas FOR EACH ROW EXECUTE FUNCTION public.set_modified_auditoria();
DROP TRIGGER IF EXISTS trg_venta_items_set_modified_auditoria ON public.venta_items;
CREATE TRIGGER trg_venta_items_set_modified_auditoria BEFORE UPDATE ON public.venta_items FOR EACH ROW EXECUTE FUNCTION public.set_modified_auditoria();
DROP TRIGGER IF EXISTS trg_venta_item_lotes_set_modified_auditoria ON public.venta_item_lotes;
CREATE TRIGGER trg_venta_item_lotes_set_modified_auditoria BEFORE UPDATE ON public.venta_item_lotes FOR EACH ROW EXECUTE FUNCTION public.set_modified_auditoria();

-- ------------------------------------------------------------
-- 3. Trigger de stock: venta/anulacion_venta solo afectan agregado.
--    Los lotes se actualizan directamente en RPC FEFO.
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
  IF NEW.transferencia_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo_movimiento IN ('entrada', 'devolucion', 'anulacion_venta') THEN
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
                  stock_por_recibir = CASE WHEN NEW.tipo_movimiento = 'entrada' THEN GREATEST(public.stock_ubicaciones.stock_por_recibir - EXCLUDED.stock_fisico, 0) ELSE public.stock_ubicaciones.stock_por_recibir END,
                  modified_by = NEW.usuario_id;

  ELSIF NEW.tipo_movimiento IN ('salida', 'venta') THEN
    SELECT GREATEST(stock_fisico - stock_comprometido, 0) INTO v_stock_actual
    FROM public.stock_ubicaciones
    WHERE org_id = NEW.org_id
      AND producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id
    FOR UPDATE;

    IF NOT FOUND OR v_stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock disponible insuficiente para %. Disponible: %, requerido: %', NEW.tipo_movimiento, COALESCE(v_stock_actual, 0), NEW.cantidad;
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

-- ------------------------------------------------------------
-- 4. Helpers y RPCs transaccionales
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_numero_venta(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num integer;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gen_numero_venta_' || p_org_id::text));

  SELECT COALESCE(MAX(CAST(substr(numero_venta, 5) AS integer)), 0) + 1
  INTO v_next_num
  FROM public.ventas
  WHERE org_id = p_org_id AND numero_venta ~ '^VTA-\d{8}$';

  RETURN 'VTA-' || LPAD(v_next_num::text, 8, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_venta_operativa(
  p_usuario_id uuid,
  p_items jsonb,
  p_clave_idempotencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario record;
  v_botica record;
  v_item jsonb;
  v_producto record;
  v_precio numeric(10,2);
  v_stock record;
  v_stock_lotes integer;
  v_solicitada integer;
  v_atendida integer;
  v_demanda integer;
  v_restante integer;
  v_lote record;
  v_venta_id uuid;
  v_item_id uuid;
  v_numero_venta text;
  v_clave text;
  v_total numeric(12,2) := 0;
  v_subtotal numeric(12,2) := 0;
  v_igv numeric(12,2) := 0;
  v_total_solicitada integer := 0;
  v_total_atendida integer := 0;
  v_resultado text := 'no_atendida';
  v_motivo text;
  v_detalle text;
  v_items_respuesta jsonb := '[]'::jsonb;
  v_venta_existente uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_usuario_id THEN
    RAISE EXCEPTION 'Usuario no coincide con la sesion autenticada';
  END IF;

  SELECT u.*, b.nombre AS botica_nombre, b.activa AS botica_activa, b.tipo AS botica_tipo
  INTO v_usuario
  FROM public.usuarios u
  LEFT JOIN public.boticas b ON b.id = u.botica_id AND b.org_id = u.org_id
  WHERE u.id = p_usuario_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario no encontrado'; END IF;
  IF NOT v_usuario.activo THEN RAISE EXCEPTION 'Usuario desactivado'; END IF;
  IF v_usuario.rol <> 'visor_botica' THEN RAISE EXCEPTION 'Solo el visor de botica puede registrar ventas'; END IF;
  IF v_usuario.botica_id IS NULL THEN RAISE EXCEPTION 'El visor no tiene botica asignada'; END IF;
  IF COALESCE(v_usuario.botica_activa, false) IS NOT TRUE OR v_usuario.botica_tipo <> 'botica' THEN RAISE EXCEPTION 'La botica asignada no esta activa para venta'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Debe incluir al menos un producto'; END IF;

  v_clave := COALESCE(NULLIF(trim(p_clave_idempotencia), ''), md5(v_usuario.id::text || ':' || p_items::text || ':' || now()::text));
  SELECT id INTO v_venta_existente FROM public.ventas WHERE org_id = v_usuario.org_id AND clave_idempotencia = v_clave;
  IF FOUND THEN
    RETURN public.obtener_venta_operativa_json(v_venta_existente, v_usuario.id);
  END IF;

  v_numero_venta := public.generar_numero_venta(v_usuario.org_id);

  INSERT INTO public.ventas (org_id, botica_id, numero_venta, registrado_por, estado, resultado_atencion, clave_idempotencia, created_by, modified_by)
  VALUES (v_usuario.org_id, v_usuario.botica_id, v_numero_venta, v_usuario.id, 'registrada', 'no_atendida', v_clave, v_usuario.id, v_usuario.id)
  RETURNING id INTO v_venta_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_solicitada := COALESCE((v_item->>'cantidad_solicitada')::integer, 0);
    v_motivo := NULLIF(trim(COALESCE(v_item->>'motivo_no_atencion', '')), '');
    v_detalle := NULLIF(trim(COALESCE(v_item->>'detalle_motivo', '')), '');

    IF v_solicitada <= 0 THEN RAISE EXCEPTION 'cantidad_solicitada debe ser mayor a 0'; END IF;

    SELECT id, org_id, codigo_interno, nombre_comercial, presentacion, estado
    INTO v_producto
    FROM public.productos
    WHERE id = (v_item->>'producto_id')::uuid
      AND org_id = v_usuario.org_id
      AND estado = 'activo';
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado o inactivo: %', v_item->>'producto_id'; END IF;

    SELECT pr.precio_venta
    INTO v_precio
    FROM public.precios pr
    WHERE pr.org_id = v_usuario.org_id
      AND pr.producto_id = v_producto.id
      AND (pr.botica_id = v_usuario.botica_id OR pr.botica_id IS NULL)
      AND pr.vigente_desde <= now()
      AND (pr.vigente_hasta IS NULL OR pr.vigente_hasta >= now())
    ORDER BY CASE WHEN pr.botica_id = v_usuario.botica_id THEN 0 ELSE 1 END, pr.vigente_desde DESC, pr.id DESC
    LIMIT 1;
    IF v_precio IS NULL THEN RAISE EXCEPTION 'No existe precio vigente para %', v_producto.nombre_comercial; END IF;

    SELECT id, stock_fisico, stock_comprometido, GREATEST(stock_fisico - stock_comprometido, 0)::integer AS stock_disponible
    INTO v_stock
    FROM public.stock_ubicaciones
    WHERE org_id = v_usuario.org_id
      AND producto_id = v_producto.id
      AND ubicacion_tipo = 'botica'
      AND ubicacion_id = v_usuario.botica_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_stock_lotes := 0;
      v_atendida := 0;
    ELSE
      SELECT COALESCE(SUM(cantidad), 0)::integer
      INTO v_stock_lotes
      FROM public.lotes
      WHERE org_id = v_usuario.org_id
        AND producto_id = v_producto.id
        AND ubicacion_tipo = 'botica'
        AND ubicacion_id = v_usuario.botica_id
        AND cantidad > 0
        AND fecha_vencimiento >= CURRENT_DATE;

      v_atendida := LEAST(v_solicitada, COALESCE(v_stock.stock_disponible, 0), COALESCE(v_stock_lotes, 0));
    END IF;

    v_demanda := v_solicitada - v_atendida;
    IF v_demanda > 0 THEN
      IF v_motivo IS NULL THEN
        v_motivo := CASE WHEN v_atendida = 0 THEN 'sin_stock' ELSE 'stock_insuficiente' END;
      END IF;
      IF v_motivo NOT IN ('stock_insuficiente', 'sin_stock', 'otro') THEN RAISE EXCEPTION 'Motivo de no atencion invalido'; END IF;
      IF v_motivo = 'otro' AND length(trim(COALESCE(v_detalle, ''))) < 5 THEN RAISE EXCEPTION 'Debe detallar el motivo cuando se selecciona otro'; END IF;
    ELSE
      v_motivo := NULL;
      v_detalle := NULL;
    END IF;

    INSERT INTO public.venta_items (venta_id, producto_id, cantidad_solicitada, cantidad_atendida, precio_unitario, importe_total, motivo_no_atencion, detalle_motivo, created_by, modified_by)
    VALUES (v_venta_id, v_producto.id, v_solicitada, v_atendida, v_precio, ROUND((v_atendida * v_precio)::numeric, 2), v_motivo, v_detalle, v_usuario.id, v_usuario.id)
    RETURNING id INTO v_item_id;

    v_restante := v_atendida;
    IF v_restante > 0 THEN
      FOR v_lote IN
        SELECT id, numero_lote, fecha_vencimiento, cantidad
        FROM public.lotes
        WHERE org_id = v_usuario.org_id
          AND producto_id = v_producto.id
          AND ubicacion_tipo = 'botica'
          AND ubicacion_id = v_usuario.botica_id
          AND cantidad > 0
          AND fecha_vencimiento >= CURRENT_DATE
        ORDER BY fecha_vencimiento ASC, created_at ASC, id ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_restante <= 0;
        INSERT INTO public.venta_item_lotes (venta_item_id, lote_id, cantidad, created_by, modified_by)
        VALUES (v_item_id, v_lote.id, LEAST(v_lote.cantidad, v_restante), v_usuario.id, v_usuario.id);

        UPDATE public.lotes
        SET cantidad = cantidad - LEAST(v_lote.cantidad, v_restante),
            modified_by = v_usuario.id
        WHERE id = v_lote.id;

        INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, org_id, venta_id, venta_item_id, created_by, modified_by)
        VALUES (v_producto.id, v_lote.id, 'botica', v_usuario.botica_id, 'venta', LEAST(v_lote.cantidad, v_restante), format('Venta %s', v_numero_venta), v_usuario.id, v_usuario.org_id, v_venta_id, v_item_id, v_usuario.id, v_usuario.id);

        v_restante := v_restante - LEAST(v_lote.cantidad, v_restante);
      END LOOP;

      IF v_restante <> 0 THEN RAISE EXCEPTION 'Asignacion FEFO inconsistente para producto %', v_producto.nombre_comercial; END IF;
    END IF;

    v_total := v_total + ROUND((v_atendida * v_precio)::numeric, 2);
    v_total_solicitada := v_total_solicitada + v_solicitada;
    v_total_atendida := v_total_atendida + v_atendida;
    v_items_respuesta := v_items_respuesta || jsonb_build_object('producto_id', v_producto.id, 'producto', v_producto.nombre_comercial, 'cantidad_solicitada', v_solicitada, 'cantidad_atendida', v_atendida, 'demanda_no_atendida', v_demanda, 'precio_unitario', v_precio, 'importe_total', ROUND((v_atendida * v_precio)::numeric, 2));
  END LOOP;

  IF v_total_solicitada = 0 THEN RAISE EXCEPTION 'Venta sin cantidades solicitadas'; END IF;
  IF v_total_atendida = 0 THEN v_resultado := 'no_atendida';
  ELSIF v_total_atendida < v_total_solicitada THEN v_resultado := 'parcial';
  ELSE v_resultado := 'completa'; END IF;

  v_subtotal := ROUND(v_total / 1.18, 2);
  v_igv := ROUND(v_total - v_subtotal, 2);

  UPDATE public.ventas
  SET subtotal = v_subtotal,
      igv = v_igv,
      total = v_total,
      resultado_atencion = v_resultado,
      modified_by = v_usuario.id
  WHERE id = v_venta_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (v_usuario.org_id, v_usuario.id, 'REGISTRAR_VENTA', 'ventas', v_venta_id, 'info', format('Venta operativa registrada %s', v_numero_venta), jsonb_build_object('numero_venta', v_numero_venta, 'botica_id', v_usuario.botica_id, 'resultado_atencion', v_resultado, 'total', v_total, 'total_solicitada', v_total_solicitada, 'total_atendida', v_total_atendida));

  RETURN public.obtener_venta_operativa_json(v_venta_id, v_usuario.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_venta_operativa(
  p_usuario_id uuid,
  p_venta_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario record;
  v_venta record;
  v_asignacion record;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_usuario_id THEN
    RAISE EXCEPTION 'Usuario no coincide con la sesion autenticada';
  END IF;

  SELECT * INTO v_usuario FROM public.usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario no encontrado'; END IF;
  IF NOT v_usuario.activo THEN RAISE EXCEPTION 'Usuario desactivado'; END IF;
  IF v_usuario.rol <> 'admin_central' THEN RAISE EXCEPTION 'Solo admin_central puede anular ventas'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN RAISE EXCEPTION 'El motivo de anulacion debe tener al menos 10 caracteres'; END IF;

  SELECT * INTO v_venta
  FROM public.ventas
  WHERE id = p_venta_id AND org_id = v_usuario.org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_venta.estado <> 'registrada' THEN RAISE EXCEPTION 'Solo se pueden anular ventas registradas'; END IF;

  FOR v_asignacion IN
    SELECT vil.*, vi.producto_id
    FROM public.venta_item_lotes vil
    JOIN public.venta_items vi ON vi.id = vil.venta_item_id
    WHERE vi.venta_id = p_venta_id
    ORDER BY vil.created_at, vil.id
  LOOP
    UPDATE public.lotes
    SET cantidad = cantidad + v_asignacion.cantidad,
        modified_by = v_usuario.id
    WHERE id = v_asignacion.lote_id;

    INSERT INTO public.movimientos_inventario (producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, org_id, venta_id, venta_item_id, created_by, modified_by)
    VALUES (v_asignacion.producto_id, v_asignacion.lote_id, 'botica', v_venta.botica_id, 'anulacion_venta', v_asignacion.cantidad, trim(p_motivo), v_usuario.id, v_usuario.org_id, p_venta_id, v_asignacion.venta_item_id, v_usuario.id, v_usuario.id);
  END LOOP;

  UPDATE public.ventas
  SET estado = 'anulada',
      motivo_anulacion = trim(p_motivo),
      anulado_por = v_usuario.id,
      anulado_en = now(),
      modified_by = v_usuario.id
  WHERE id = p_venta_id;

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
  VALUES (v_usuario.org_id, v_usuario.id, 'ANULAR_VENTA', 'ventas', p_venta_id, 'advertencia', trim(p_motivo), jsonb_build_object('numero_venta', v_venta.numero_venta, 'botica_id', v_venta.botica_id, 'total', v_venta.total));

  RETURN public.obtener_venta_operativa_json(p_venta_id, v_usuario.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_venta_operativa_json(p_venta_id uuid, p_usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', v.id,
    'org_id', v.org_id,
    'botica_id', v.botica_id,
    'botica', b.nombre,
    'numero_venta', v.numero_venta,
    'fecha_venta', v.fecha_venta,
    'registrado_por', v.registrado_por,
    'registrado_por_nombre', u.nombre,
    'subtotal', v.subtotal,
    'igv', v.igv,
    'total', v.total,
    'estado', v.estado,
    'resultado_atencion', v.resultado_atencion,
    'motivo_anulacion', v.motivo_anulacion,
    'anulado_en', v.anulado_en,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', vi.id,
        'producto_id', vi.producto_id,
        'codigo_producto', p.codigo_interno,
        'producto', p.nombre_comercial,
        'presentacion', p.presentacion,
        'cantidad_solicitada', vi.cantidad_solicitada,
        'cantidad_atendida', vi.cantidad_atendida,
        'demanda_no_atendida', vi.demanda_no_atendida,
        'precio_unitario', vi.precio_unitario,
        'importe_total', vi.importe_total,
        'motivo_no_atencion', vi.motivo_no_atencion,
        'detalle_motivo', vi.detalle_motivo,
        'lotes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('lote_id', l.id, 'numero_lote', l.numero_lote, 'fecha_vencimiento', l.fecha_vencimiento, 'cantidad', vil.cantidad) ORDER BY l.fecha_vencimiento, l.numero_lote)
          FROM public.venta_item_lotes vil
          JOIN public.lotes l ON l.id = vil.lote_id
          WHERE vil.venta_item_id = vi.id
        ), '[]'::jsonb)
      ) ORDER BY p.nombre_comercial)
      FROM public.venta_items vi
      JOIN public.productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = v.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.ventas v
  JOIN public.boticas b ON b.id = v.botica_id
  JOIN public.usuarios u ON u.id = v.registrado_por
  WHERE v.id = p_venta_id;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 5. Vistas de consulta operativa, demanda, reportes y ML
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_ventas_operativas
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.org_id,
  v.botica_id,
  b.nombre AS botica,
  v.numero_venta,
  v.fecha_venta,
  v.registrado_por,
  u.nombre AS registrado_por_nombre,
  v.subtotal,
  v.igv,
  v.total,
  v.estado,
  v.resultado_atencion,
  v.motivo_anulacion,
  v.anulado_por,
  v.anulado_en,
  COALESCE(SUM(vi.cantidad_solicitada), 0)::integer AS cantidad_solicitada,
  COALESCE(SUM(vi.cantidad_atendida), 0)::integer AS cantidad_atendida,
  COALESCE(SUM(vi.demanda_no_atendida), 0)::integer AS demanda_no_atendida,
  COUNT(vi.id)::integer AS total_items,
  string_agg(DISTINCT p.nombre_comercial, ', ' ORDER BY p.nombre_comercial) AS productos_resumen
FROM public.ventas v
JOIN public.boticas b ON b.id = v.botica_id AND b.org_id = v.org_id
JOIN public.usuarios u ON u.id = v.registrado_por
LEFT JOIN public.venta_items vi ON vi.venta_id = v.id
LEFT JOIN public.productos p ON p.id = vi.producto_id
GROUP BY v.id, b.nombre, u.nombre;

CREATE OR REPLACE VIEW public.vw_demanda_no_atendida_operativa
WITH (security_invoker = true) AS
SELECT
  vi.id,
  v.id AS venta_id,
  v.org_id,
  v.botica_id,
  b.nombre AS botica,
  v.numero_venta,
  v.fecha_venta,
  vi.producto_id,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial AS producto,
  vi.cantidad_solicitada,
  vi.cantidad_atendida,
  vi.demanda_no_atendida,
  vi.motivo_no_atencion,
  vi.detalle_motivo
FROM public.venta_items vi
JOIN public.ventas v ON v.id = vi.venta_id
JOIN public.boticas b ON b.id = v.botica_id AND b.org_id = v.org_id
JOIN public.productos p ON p.id = vi.producto_id AND p.org_id = v.org_id
WHERE v.estado = 'registrada' AND vi.demanda_no_atendida > 0;

CREATE OR REPLACE VIEW public.vw_ventas_ml_unificadas
WITH (security_invoker = true) AS
SELECT
  vh.org_id,
  vh.botica_id,
  vh.producto_id,
  vh.fecha_venta::date AS fecha_venta,
  vh.cantidad::integer AS cantidad,
  vh.precio_unitario,
  vh.cantidad::integer AS cantidad_solicitada,
  0::integer AS demanda_no_atendida,
  'historica'::text AS origen,
  vh.id AS origen_id
FROM public.ventas_historicas vh
UNION ALL
SELECT
  v.org_id,
  v.botica_id,
  vi.producto_id,
  v.fecha_venta::date AS fecha_venta,
  vi.cantidad_atendida::integer AS cantidad,
  vi.precio_unitario,
  vi.cantidad_solicitada,
  vi.demanda_no_atendida,
  'operativa'::text AS origen,
  vi.id AS origen_id
FROM public.ventas v
JOIN public.venta_items vi ON vi.venta_id = v.id
WHERE v.estado = 'registrada';

CREATE OR REPLACE VIEW public.vw_demanda_semanal_ml
WITH (security_invoker = true) AS
WITH ventas_semana AS (
  SELECT
    date_trunc('week', vu.fecha_venta)::date AS fecha_semana,
    vu.org_id,
    vu.botica_id,
    vu.producto_id,
    SUM(vu.cantidad)::double precision AS cantidad_vendida,
    SUM(vu.demanda_no_atendida)::double precision AS demanda_insatisfecha
  FROM public.vw_ventas_ml_unificadas vu
  GROUP BY 1, 2, 3, 4
), rango_semanas AS (
  SELECT org_id, date_trunc('week', MIN(fecha_venta))::date AS semana_inicio, date_trunc('week', MAX(fecha_venta))::date AS semana_fin
  FROM public.vw_ventas_ml_unificadas
  GROUP BY org_id
), series_relevantes AS (
  SELECT DISTINCT vu.org_id, vu.botica_id, vu.producto_id
  FROM public.vw_ventas_ml_unificadas vu
  JOIN public.productos p ON p.id = vu.producto_id AND p.org_id = vu.org_id AND p.estado = 'activo'
  JOIN public.boticas b ON b.id = vu.botica_id AND b.org_id = vu.org_id AND b.activa AND b.tipo = 'botica'
), calendario AS (
  SELECT sr.org_id, sr.botica_id, sr.producto_id, generate_series(rs.semana_inicio, rs.semana_fin, interval '1 week')::date AS fecha_semana
  FROM series_relevantes sr
  JOIN rango_semanas rs ON rs.org_id = sr.org_id
), stock_semana AS (
  SELECT DISTINCT ON (sh.org_id, sh.ubicacion_id, sh.producto_id, date_trunc('week', sh.fecha_snapshot_dia)::date)
    date_trunc('week', sh.fecha_snapshot_dia)::date AS fecha_semana,
    sh.org_id,
    sh.ubicacion_id AS botica_id,
    sh.producto_id,
    sh.cantidad_disponible AS stock_inicio_semana,
    sh.stock_minimo,
    sh.stock_maximo
  FROM public.stock_historico sh
  ORDER BY sh.org_id, sh.ubicacion_id, sh.producto_id, date_trunc('week', sh.fecha_snapshot_dia)::date, sh.fecha_snapshot_dia
), proveedor_ranked AS (
  SELECT pp.*, ROW_NUMBER() OVER (PARTITION BY pp.org_id, pp.producto_id ORDER BY pp.lead_time_dias NULLS LAST, pp.precio_referencial NULLS LAST, pp.id) AS rn
  FROM public.proveedor_producto pp
  WHERE COALESCE(pp.activo, true)
)
SELECT
  c.fecha_semana,
  c.org_id,
  c.botica_id,
  c.producto_id,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial,
  ct.nombre AS categoria_terapeutica,
  COALESCE(v.cantidad_vendida, 0)::double precision AS cantidad_vendida,
  COALESCE(v.demanda_insatisfecha, 0)::double precision AS demanda_insatisfecha,
  CASE WHEN COALESCE(s.stock_inicio_semana, su.stock_fisico, 0) <= 0 AND COALESCE(v.cantidad_vendida, 0) > 0 THEN 1 ELSE 0 END::integer AS stockout_flag,
  COALESCE(s.stock_inicio_semana, su.stock_fisico, 0)::double precision AS stock_inicio_semana,
  COALESCE(s.stock_minimo, su.stock_minimo, 0)::double precision AS stock_minimo,
  COALESCE(s.stock_maximo, su.stock_maximo, 0)::double precision AS stock_maximo,
  COALESCE(pr.lead_time_dias, pr.lead_time_especifico, 7)::integer AS lead_time_dias
FROM calendario c
JOIN public.productos p ON p.id = c.producto_id AND p.org_id = c.org_id
JOIN public.boticas b ON b.id = c.botica_id AND b.org_id = c.org_id
LEFT JOIN public.categorias_terapeuticas ct ON ct.id = p.categoria_terapeutica_id AND ct.org_id = p.org_id
LEFT JOIN ventas_semana v ON v.org_id = c.org_id AND v.botica_id = c.botica_id AND v.producto_id = c.producto_id AND v.fecha_semana = c.fecha_semana
LEFT JOIN stock_semana s ON s.org_id = c.org_id AND s.botica_id = c.botica_id AND s.producto_id = c.producto_id AND s.fecha_semana = c.fecha_semana
LEFT JOIN public.stock_ubicaciones su ON su.org_id = c.org_id AND su.producto_id = c.producto_id AND su.ubicacion_id = c.botica_id
LEFT JOIN proveedor_ranked pr ON pr.org_id = c.org_id AND pr.producto_id = c.producto_id AND pr.rn = 1;

COMMENT ON VIEW public.vw_ventas_ml_unificadas IS 'Fuente lógica para ML. Une ventas_historicas importadas con venta_items operativos registrados. Las ventas anuladas se excluyen; cantidad equivale a cantidad atendida/vendida.';
COMMENT ON VIEW public.vw_demanda_semanal_ml IS 'Vista semanal ML basada en vw_ventas_ml_unificadas. Mantiene cantidad_vendida como unidades atendidas/vendidas y expone demanda_insatisfecha operativa para analisis posterior.';

-- ------------------------------------------------------------
-- 6. RLS nuevas tablas. Escrituras solo por RPC controladas.
-- ------------------------------------------------------------
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_item_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ventas" ON public.ventas;
DROP POLICY IF EXISTS "operador_select_ventas" ON public.ventas;
DROP POLICY IF EXISTS "visor_select_ventas" ON public.ventas;
CREATE POLICY "admin_select_ventas" ON public.ventas FOR SELECT
  USING (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario());
CREATE POLICY "operador_select_ventas" ON public.ventas FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_ventas" ON public.ventas FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND botica_id = public.obtener_botica_usuario());

DROP POLICY IF EXISTS "admin_select_venta_items" ON public.venta_items;
DROP POLICY IF EXISTS "operador_select_venta_items" ON public.venta_items;
DROP POLICY IF EXISTS "visor_select_venta_items" ON public.venta_items;
CREATE POLICY "admin_select_venta_items" ON public.venta_items FOR SELECT
  USING (public.obtener_rol_usuario() = 'admin_central' AND EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_select_venta_items" ON public.venta_items FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.org_id = public.obtener_org_usuario()));
CREATE POLICY "visor_select_venta_items" ON public.venta_items FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.org_id = public.obtener_org_usuario() AND v.botica_id = public.obtener_botica_usuario()));

DROP POLICY IF EXISTS "admin_select_venta_item_lotes" ON public.venta_item_lotes;
DROP POLICY IF EXISTS "operador_select_venta_item_lotes" ON public.venta_item_lotes;
DROP POLICY IF EXISTS "visor_select_venta_item_lotes" ON public.venta_item_lotes;
CREATE POLICY "admin_select_venta_item_lotes" ON public.venta_item_lotes FOR SELECT
  USING (public.obtener_rol_usuario() = 'admin_central' AND EXISTS (SELECT 1 FROM public.venta_items vi JOIN public.ventas v ON v.id = vi.venta_id WHERE vi.id = venta_item_id AND v.org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_select_venta_item_lotes" ON public.venta_item_lotes FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND EXISTS (SELECT 1 FROM public.venta_items vi JOIN public.ventas v ON v.id = vi.venta_id WHERE vi.id = venta_item_id AND v.org_id = public.obtener_org_usuario()));
CREATE POLICY "visor_select_venta_item_lotes" ON public.venta_item_lotes FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND EXISTS (SELECT 1 FROM public.venta_items vi JOIN public.ventas v ON v.id = vi.venta_id WHERE vi.id = venta_item_id AND v.org_id = public.obtener_org_usuario() AND v.botica_id = public.obtener_botica_usuario()));

COMMIT;
