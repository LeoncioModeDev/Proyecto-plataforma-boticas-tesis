-- ============================================================
-- Migracion 36: alineacion incremental del modelo de datos para
-- ML, importaciones relacionales y aislamiento multiempresa.
--
-- No reemplaza migraciones previas. No crea organizaciones.
-- Requiere diagnostico previo de duplicados antes de aplicar UNIQUE.
-- ============================================================

BEGIN;

-- ============================================================
-- Utilidades de validacion previa
-- ============================================================
CREATE OR REPLACE FUNCTION public.fallar_si_existen_duplicados(
  p_tabla text,
  p_total bigint,
  p_detalle text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_total > 0 THEN
    RAISE EXCEPTION 'No se puede crear UNIQUE en %. Duplicados pendientes: %. Detalle: %', p_tabla, p_total, p_detalle;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fallar_si_existen_duplicados(text, bigint, text) IS
  'Bloquea constraints UNIQUE cuando el diagnostico real detecta duplicados pendientes de revision.';

-- ============================================================
-- Categorias terapeuticas y productos
-- ============================================================
COMMENT ON TABLE public.categorias_terapeuticas IS
  'Categoria terapeutica operativa usada por el modelo ML para configuracion adaptativa, alpha y evaluacion por categoria. No sustituye el codigo ATC.';
COMMENT ON COLUMN public.categorias_terapeuticas.codigo IS
  'Codigo de negocio normalizado con trim y uppercase. Se usa en importaciones publicas dentro de org_id.';
COMMENT ON COLUMN public.categorias_terapeuticas.nombre IS
  'Nombre operativo de la categoria terapeutica, unico por organizacion ignorando mayusculas.';
COMMENT ON COLUMN public.productos.categoria_terapeutica_id IS
  'Categoria terapeutica operativa del producto. Nullable temporalmente para migrar productos existentes sin destruir datos.';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_categorias_terapeuticas_codigo_normalizado') THEN
    ALTER TABLE public.categorias_terapeuticas
      ADD CONSTRAINT chk_categorias_terapeuticas_codigo_normalizado
      CHECK (codigo = upper(trim(codigo)) AND codigo <> '') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_categorias_terapeuticas_nombre_normalizado') THEN
    ALTER TABLE public.categorias_terapeuticas
      ADD CONSTRAINT chk_categorias_terapeuticas_nombre_normalizado
      CHECK (nombre = trim(nombre) AND nombre <> '') NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categorias_terapeuticas_org_activo
  ON public.categorias_terapeuticas(org_id, activo);
CREATE INDEX IF NOT EXISTS idx_categorias_terapeuticas_org_codigo_busqueda
  ON public.categorias_terapeuticas(org_id, codigo);
CREATE INDEX IF NOT EXISTS idx_productos_org_categoria_terapeutica
  ON public.productos(org_id, categoria_terapeutica_id);

CREATE OR REPLACE FUNCTION public.validar_producto_categoria_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_categoria uuid;
BEGIN
  IF NEW.categoria_terapeutica_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id INTO v_org_categoria
  FROM public.categorias_terapeuticas
  WHERE id = NEW.categoria_terapeutica_id;

  IF v_org_categoria IS NULL THEN
    RAISE EXCEPTION 'La categoria terapeutica indicada no existe';
  END IF;
  IF v_org_categoria <> NEW.org_id THEN
    RAISE EXCEPTION 'La categoria terapeutica pertenece a otra organizacion';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producto_categoria_misma_org ON public.productos;
CREATE TRIGGER trg_producto_categoria_misma_org
  BEFORE INSERT OR UPDATE OF org_id, categoria_terapeutica_id ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.validar_producto_categoria_misma_org();

CREATE OR REPLACE VIEW public.vw_productos_activos_sin_categoria AS
SELECT id, org_id, codigo_interno, nombre_comercial, estado
FROM public.productos
WHERE estado = 'activo' AND categoria_terapeutica_id IS NULL;

COMMENT ON VIEW public.vw_productos_activos_sin_categoria IS
  'Reporte operativo de productos activos aun sin categoria terapeutica. No elimina ni bloquea productos existentes.';

-- ============================================================
-- proveedor_producto canonico
-- ============================================================
ALTER TABLE public.proveedor_producto
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS lead_time_dias integer,
  ADD COLUMN IF NOT EXISTS precio_referencial numeric(10,2),
  ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multiplo_empaque integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.proveedor_producto pp
SET org_id = pr.org_id
FROM public.proveedores pr
WHERE pp.proveedor_id = pr.id AND pp.org_id IS NULL;

UPDATE public.proveedor_producto pp
SET org_id = p.org_id
FROM public.productos p
WHERE pp.producto_id = p.id AND pp.org_id IS NULL;

UPDATE public.proveedor_producto
SET lead_time_dias = lead_time_especifico
WHERE lead_time_dias IS NULL AND lead_time_especifico IS NOT NULL;

UPDATE public.proveedor_producto
SET precio_referencial = precio_compra_referencial
WHERE precio_referencial IS NULL AND precio_compra_referencial IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.proveedor_producto WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'proveedor_producto contiene filas sin org_id resoluble desde proveedor/producto';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.proveedor_producto pp
    JOIN public.proveedores pr ON pr.id = pp.proveedor_id
    JOIN public.productos p ON p.id = pp.producto_id
    WHERE pp.org_id <> pr.org_id OR pp.org_id <> p.org_id
  ) THEN
    RAISE EXCEPTION 'proveedor_producto contiene relaciones entre organizaciones distintas';
  END IF;
END $$;

ALTER TABLE public.proveedor_producto ALTER COLUMN org_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_lead_time_dias') THEN
    ALTER TABLE public.proveedor_producto ADD CONSTRAINT chk_proveedor_producto_lead_time_dias CHECK (lead_time_dias IS NULL OR lead_time_dias >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_precio_referencial') THEN
    ALTER TABLE public.proveedor_producto ADD CONSTRAINT chk_proveedor_producto_precio_referencial CHECK (precio_referencial IS NULL OR precio_referencial >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_cantidad_minima_compra') THEN
    ALTER TABLE public.proveedor_producto ADD CONSTRAINT chk_proveedor_producto_cantidad_minima_compra CHECK (cantidad_minima_compra > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_multiplo_empaque') THEN
    ALTER TABLE public.proveedor_producto ADD CONSTRAINT chk_proveedor_producto_multiplo_empaque CHECK (multiplo_empaque > 0) NOT VALID;
  END IF;
END $$;

SELECT public.fallar_si_existen_duplicados(
  'proveedor_producto',
  COUNT(*),
  'clave org_id, proveedor_id, producto_id'
)
FROM (
  SELECT org_id, proveedor_id, producto_id
  FROM public.proveedor_producto
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
) d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedor_producto_org_proveedor_producto_unique
  ON public.proveedor_producto(org_id, proveedor_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_org_proveedor
  ON public.proveedor_producto(org_id, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_org_producto
  ON public.proveedor_producto(org_id, producto_id);

CREATE OR REPLACE FUNCTION public.validar_proveedor_producto_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_proveedor uuid;
  v_org_producto uuid;
BEGIN
  SELECT org_id INTO v_org_proveedor FROM public.proveedores WHERE id = NEW.proveedor_id;
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;

  IF v_org_proveedor IS NULL OR v_org_producto IS NULL THEN
    RAISE EXCEPTION 'Proveedor o producto no existe';
  END IF;
  IF v_org_proveedor <> v_org_producto THEN
    RAISE EXCEPTION 'Proveedor y producto pertenecen a organizaciones distintas';
  END IF;
  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_org_proveedor;
  END IF;
  IF NEW.org_id <> v_org_proveedor THEN
    RAISE EXCEPTION 'org_id de proveedor_producto no coincide con proveedor/producto';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proveedor_producto_misma_org ON public.proveedor_producto;
CREATE TRIGGER trg_proveedor_producto_misma_org
  BEFORE INSERT OR UPDATE OF org_id, proveedor_id, producto_id ON public.proveedor_producto
  FOR EACH ROW EXECUTE FUNCTION public.validar_proveedor_producto_misma_org();

COMMENT ON COLUMN public.proveedor_producto.lead_time_especifico IS
  'DEPRECADO temporalmente: usar lead_time_dias como columna canonica.';
COMMENT ON COLUMN public.proveedor_producto.precio_compra_referencial IS
  'DEPRECADO temporalmente: usar precio_referencial como columna canonica.';
COMMENT ON COLUMN public.proveedor_producto.precio_referencial IS
  'Precio referencial de compra al proveedor. No confundir con precios.precio_costo.';

-- ============================================================
-- Precios
-- ============================================================
ALTER TABLE public.precios
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.precios pr
SET org_id = p.org_id
FROM public.productos p
WHERE pr.producto_id = p.id AND pr.org_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.precios WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'precios contiene filas sin org_id resoluble desde producto';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.precios pr
    JOIN public.productos p ON p.id = pr.producto_id
    LEFT JOIN public.boticas b ON b.id = pr.botica_id
    WHERE pr.org_id <> p.org_id OR (pr.botica_id IS NOT NULL AND b.org_id <> pr.org_id)
  ) THEN
    RAISE EXCEPTION 'precios contiene relaciones cruzadas entre organizaciones';
  END IF;
END $$;

ALTER TABLE public.precios ALTER COLUMN org_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_precios_precio_venta_no_negativo') THEN
    ALTER TABLE public.precios ADD CONSTRAINT chk_precios_precio_venta_no_negativo CHECK (precio_venta >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_precios_precio_costo_no_negativo') THEN
    ALTER TABLE public.precios ADD CONSTRAINT chk_precios_precio_costo_no_negativo CHECK (precio_costo >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_precios_vigencia_valida') THEN
    ALTER TABLE public.precios ADD CONSTRAINT chk_precios_vigencia_valida CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_precios_org_producto_botica_vigente_desde
  ON public.precios(org_id, producto_id, botica_id, vigente_desde);
CREATE INDEX IF NOT EXISTS idx_precios_org_producto_vigente_hasta
  ON public.precios(org_id, producto_id, vigente_hasta);

CREATE OR REPLACE FUNCTION public.validar_precio_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_botica uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  IF v_org_producto IS NULL THEN
    RAISE EXCEPTION 'El producto del precio no existe';
  END IF;
  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_org_producto;
  END IF;
  IF NEW.org_id <> v_org_producto THEN
    RAISE EXCEPTION 'El precio pertenece a una organizacion distinta a la del producto';
  END IF;
  IF NEW.botica_id IS NOT NULL THEN
    SELECT org_id INTO v_org_botica FROM public.boticas WHERE id = NEW.botica_id;
    IF v_org_botica IS NULL OR v_org_botica <> NEW.org_id THEN
      RAISE EXCEPTION 'La botica del precio pertenece a otra organizacion';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_precio_misma_org ON public.precios;
CREATE TRIGGER trg_precio_misma_org
  BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id ON public.precios
  FOR EACH ROW EXECUTE FUNCTION public.validar_precio_misma_org();

-- ============================================================
-- Ventas historicas
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ventas_historicas_importacion_id_fkey') THEN
    ALTER TABLE public.ventas_historicas
      ADD CONSTRAINT ventas_historicas_importacion_id_fkey
      FOREIGN KEY (importacion_id) REFERENCES public.importaciones_datos(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ventas_historicas_org_botica_producto_fecha
  ON public.ventas_historicas(org_id, botica_id, producto_id, fecha_venta);

COMMENT ON COLUMN public.ventas_historicas.importacion_id IS
  'Importacion que origino la venta historica. FK con ON DELETE SET NULL; las ventas historicas no generan movimientos de inventario.';

-- ============================================================
-- Stock actual e historico
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_cantidad_no_negativa') THEN
    ALTER TABLE public.stock_ubicaciones ADD CONSTRAINT chk_stock_ubicaciones_cantidad_no_negativa CHECK (cantidad_disponible >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_minimo_no_negativo') THEN
    ALTER TABLE public.stock_ubicaciones ADD CONSTRAINT chk_stock_ubicaciones_minimo_no_negativo CHECK (stock_minimo >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_maximo_valido') THEN
    ALTER TABLE public.stock_ubicaciones ADD CONSTRAINT chk_stock_ubicaciones_maximo_valido CHECK (stock_maximo IS NULL OR stock_maximo >= stock_minimo) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_por_recibir_no_negativo') THEN
    ALTER TABLE public.stock_ubicaciones ADD CONSTRAINT chk_stock_ubicaciones_por_recibir_no_negativo CHECK (stock_por_recibir >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_en_transito_no_negativo') THEN
    ALTER TABLE public.stock_ubicaciones ADD CONSTRAINT chk_stock_ubicaciones_en_transito_no_negativo CHECK (stock_en_transito >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_historico_cantidad_no_negativa') THEN
    ALTER TABLE public.stock_historico ADD CONSTRAINT chk_stock_historico_cantidad_no_negativa CHECK (cantidad_disponible >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_historico_minimo_no_negativo') THEN
    ALTER TABLE public.stock_historico ADD CONSTRAINT chk_stock_historico_minimo_no_negativo CHECK (stock_minimo >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_historico_maximo_valido') THEN
    ALTER TABLE public.stock_historico ADD CONSTRAINT chk_stock_historico_maximo_valido CHECK (stock_maximo IS NULL OR stock_maximo >= stock_minimo) NOT VALID;
  END IF;
END $$;

SELECT public.fallar_si_existen_duplicados('stock_ubicaciones', COUNT(*), 'clave org_id, producto_id, ubicacion_tipo, ubicacion_id')
FROM (
  SELECT org_id, producto_id, ubicacion_tipo, ubicacion_id
  FROM public.stock_ubicaciones
  GROUP BY 1, 2, 3, 4
  HAVING COUNT(*) > 1
) d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ubicaciones_org_producto_ubicacion_unique
  ON public.stock_ubicaciones(org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_stock_ubicaciones_org_ubicacion_producto
  ON public.stock_ubicaciones(org_id, ubicacion_id, producto_id);

SELECT public.fallar_si_existen_duplicados('stock_historico', COUNT(*), 'clave org_id, producto_id, ubicacion_tipo, ubicacion_id, fecha_snapshot_dia')
FROM (
  SELECT org_id, producto_id, ubicacion_tipo, ubicacion_id, fecha_snapshot_dia
  FROM public.stock_historico
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
) d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_historico_org_producto_ubicacion_dia_unique
  ON public.stock_historico(org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha_snapshot_dia);
CREATE INDEX IF NOT EXISTS idx_stock_historico_org_fecha_snapshot
  ON public.stock_historico(org_id, fecha_snapshot_dia);

-- ============================================================
-- Lotes
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lotes_cantidad_no_negativa') THEN
    ALTER TABLE public.lotes ADD CONSTRAINT chk_lotes_cantidad_no_negativa CHECK (cantidad >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.lotes ALTER COLUMN fecha_vencimiento SET NOT NULL;
COMMENT ON COLUMN public.lotes.cantidad IS
  'Cantidad disponible actual del lote. No se duplica con una columna cantidad_disponible.';

SELECT public.fallar_si_existen_duplicados('lotes', COUNT(*), 'clave org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote')
FROM (
  SELECT org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote
  FROM public.lotes
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
) d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_org_producto_ubicacion_lote_unique
  ON public.lotes(org_id, producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero_lote);
CREATE INDEX IF NOT EXISTS idx_lotes_org_fecha_vencimiento
  ON public.lotes(org_id, fecha_vencimiento);

CREATE OR REPLACE FUNCTION public.validar_lote_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_ubicacion uuid;
  v_org_proveedor uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  IF v_org_producto IS NULL THEN
    RAISE EXCEPTION 'El producto del lote no existe';
  END IF;
  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_org_producto;
  END IF;
  IF NEW.org_id <> v_org_producto THEN
    RAISE EXCEPTION 'El lote pertenece a una organizacion distinta a la del producto';
  END IF;
  IF NEW.ubicacion_id IS NOT NULL THEN
    SELECT org_id INTO v_org_ubicacion FROM public.boticas WHERE id = NEW.ubicacion_id;
    IF v_org_ubicacion IS NULL OR v_org_ubicacion <> NEW.org_id THEN
      RAISE EXCEPTION 'La ubicacion del lote pertenece a otra organizacion';
    END IF;
  END IF;
  IF NEW.proveedor_id IS NOT NULL THEN
    SELECT org_id INTO v_org_proveedor FROM public.proveedores WHERE id = NEW.proveedor_id;
    IF v_org_proveedor IS NULL OR v_org_proveedor <> NEW.org_id THEN
      RAISE EXCEPTION 'El proveedor del lote pertenece a otra organizacion';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lote_misma_org ON public.lotes;
CREATE TRIGGER trg_lote_misma_org
  BEFORE INSERT OR UPDATE OF org_id, producto_id, ubicacion_id, proveedor_id ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.validar_lote_misma_org();

-- ============================================================
-- Modelos ML y metricas oficiales V4
-- ============================================================
ALTER TABLE public.modelos_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS macro_mape double precision,
  ADD COLUMN IF NOT EXISTS metricas_jsonb jsonb;

UPDATE public.modelos_ml
SET macro_mape = 12.349016982065416,
    metricas_jsonb = jsonb_build_object(
      'macro_mape', 12.349016982065416,
      'mae', 14.45,
      'rmse', 20.08,
      'mape', 34.14,
      'smape', 28.79,
      'wape', 26.33
    )
WHERE version IN ('v1.0.0', 'V4', 'v4', 'oficial-v4')
  AND (macro_mape IS NULL OR metricas_jsonb IS NULL);

COMMENT ON COLUMN public.modelos_ml.org_id IS
  'NULL representa modelo global; con valor representa modelo especifico de organizacion.';
COMMENT ON CONSTRAINT modelos_ml_version_key ON public.modelos_ml IS
  'version permanece UNIQUE mientras los modelos productivos sean globales. Si hay modelos por organizacion, se debe migrar a unicidad compuesta.';

-- ============================================================
-- Predicciones, inferencias, drift, alertas y recomendaciones ML
-- ============================================================
ALTER TABLE public.predicciones_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS intervalo_sup double precision,
  ADD COLUMN IF NOT EXISTS horizonte integer,
  ADD COLUMN IF NOT EXISTS prediccion_sarima double precision,
  ADD COLUMN IF NOT EXISTS prediccion_xgboost double precision,
  ADD COLUMN IF NOT EXISTS metodo_aplicado text,
  ADD COLUMN IF NOT EXISTS alpha double precision;

UPDATE public.predicciones_ml p
SET org_id = b.org_id
FROM public.boticas b
WHERE p.botica_id = b.id AND p.org_id IS NULL;

UPDATE public.predicciones_ml
SET intervalo_sup = intervalosup
WHERE intervalo_sup IS NULL AND intervalosup IS NOT NULL;

ALTER TABLE public.predicciones_ml
  ALTER COLUMN intervalo_inf DROP NOT NULL,
  ALTER COLUMN intervalosup DROP NOT NULL,
  ALTER COLUMN confianza DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_predicciones_ml_horizonte') THEN
    ALTER TABLE public.predicciones_ml ADD CONSTRAINT chk_predicciones_ml_horizonte CHECK (horizonte IS NULL OR horizonte BETWEEN 1 AND 12) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_predicciones_ml_cantidad_no_negativa') THEN
    ALTER TABLE public.predicciones_ml ADD CONSTRAINT chk_predicciones_ml_cantidad_no_negativa CHECK (cantidad_predicha >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_predicciones_ml_sarima_no_negativa') THEN
    ALTER TABLE public.predicciones_ml ADD CONSTRAINT chk_predicciones_ml_sarima_no_negativa CHECK (prediccion_sarima IS NULL OR prediccion_sarima >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_predicciones_ml_xgboost_no_negativa') THEN
    ALTER TABLE public.predicciones_ml ADD CONSTRAINT chk_predicciones_ml_xgboost_no_negativa CHECK (prediccion_xgboost IS NULL OR prediccion_xgboost >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_predicciones_ml_alpha_no_negativo') THEN
    ALTER TABLE public.predicciones_ml ADD CONSTRAINT chk_predicciones_ml_alpha_no_negativo CHECK (alpha IS NULL OR alpha >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.inferencias ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id);
UPDATE public.inferencias i SET org_id = b.org_id FROM public.boticas b WHERE i.botica_id = b.id AND i.org_id IS NULL;

ALTER TABLE public.alertas_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS modelo_version_id uuid REFERENCES public.modelos_ml(id),
  ADD COLUMN IF NOT EXISTS mensaje text,
  ADD COLUMN IF NOT EXISTS stock_actual integer,
  ADD COLUMN IF NOT EXISTS stock_proyectado double precision,
  ADD COLUMN IF NOT EXISTS cantidad_recomendada integer,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date,
  ADD COLUMN IF NOT EXISTS metadata_jsonb jsonb;
UPDATE public.alertas_ml a SET org_id = b.org_id FROM public.boticas b WHERE a.botica_id = b.id AND a.org_id IS NULL;

ALTER TABLE public.recomendaciones_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id),
  ADD COLUMN IF NOT EXISTS botica_id uuid REFERENCES public.boticas(id),
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES public.proveedores(id),
  ADD COLUMN IF NOT EXISTS modelo_version_id uuid REFERENCES public.modelos_ml(id),
  ADD COLUMN IF NOT EXISTS precio_referencial numeric(10,2),
  ADD COLUMN IF NOT EXISTS costo_estimado numeric(12,2),
  ADD COLUMN IF NOT EXISTS stock_actual integer,
  ADD COLUMN IF NOT EXISTS stock_seguridad double precision,
  ADD COLUMN IF NOT EXISTS demanda_pronosticada double precision,
  ADD COLUMN IF NOT EXISTS nivel_urgencia text,
  ADD COLUMN IF NOT EXISTS metadata_jsonb jsonb;
UPDATE public.recomendaciones_ml r SET org_id = b.org_id FROM public.boticas b WHERE r.botica_destino_id = b.id AND r.org_id IS NULL;
UPDATE public.recomendaciones_ml SET botica_id = botica_destino_id WHERE botica_id IS NULL;

ALTER TABLE public.drift_metricas ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizaciones(id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.predicciones_ml WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'predicciones_ml contiene org_id NULL sin resolver';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inferencias WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'inferencias contiene org_id NULL sin resolver';
  END IF;
  IF EXISTS (SELECT 1 FROM public.alertas_ml WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'alertas_ml contiene org_id NULL sin resolver';
  END IF;
  IF EXISTS (SELECT 1 FROM public.recomendaciones_ml WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'recomendaciones_ml contiene org_id NULL sin resolver';
  END IF;
  IF EXISTS (SELECT 1 FROM public.drift_metricas WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'drift_metricas contiene org_id NULL sin resolver. No se asignan organizaciones arbitrarias.';
  END IF;
END $$;

ALTER TABLE public.predicciones_ml ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.inferencias ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.alertas_ml ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.recomendaciones_ml ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.drift_metricas ALTER COLUMN org_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recomendaciones_ml_cantidad_sugerida_no_negativa') THEN
    ALTER TABLE public.recomendaciones_ml ADD CONSTRAINT chk_recomendaciones_ml_cantidad_sugerida_no_negativa CHECK (cantidad_sugerida >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recomendaciones_ml_precio_referencial_no_negativo') THEN
    ALTER TABLE public.recomendaciones_ml ADD CONSTRAINT chk_recomendaciones_ml_precio_referencial_no_negativo CHECK (precio_referencial IS NULL OR precio_referencial >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recomendaciones_ml_costo_estimado_no_negativo') THEN
    ALTER TABLE public.recomendaciones_ml ADD CONSTRAINT chk_recomendaciones_ml_costo_estimado_no_negativo CHECK (costo_estimado IS NULL OR costo_estimado >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recomendaciones_ml_stock_seguridad_no_negativo') THEN
    ALTER TABLE public.recomendaciones_ml ADD CONSTRAINT chk_recomendaciones_ml_stock_seguridad_no_negativo CHECK (stock_seguridad IS NULL OR stock_seguridad >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recomendaciones_ml_demanda_no_negativa') THEN
    ALTER TABLE public.recomendaciones_ml ADD CONSTRAINT chk_recomendaciones_ml_demanda_no_negativa CHECK (demanda_pronosticada IS NULL OR demanda_pronosticada >= 0) NOT VALID;
  END IF;
END $$;

SELECT public.fallar_si_existen_duplicados('predicciones_ml', COUNT(*), 'clave org_id, producto_id, botica_id, periodo_inicio, modelo_version_id')
FROM (
  SELECT org_id, producto_id, botica_id, periodo_inicio, modelo_version_id
  FROM public.predicciones_ml
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
) d;

SELECT public.fallar_si_existen_duplicados('inferencias', COUNT(*), 'clave org_id, producto_id, botica_id, fecha_pred, modelo_version_id')
FROM (
  SELECT org_id, producto_id, botica_id, fecha_pred, modelo_version_id
  FROM public.inferencias
  GROUP BY 1, 2, 3, 4, 5
  HAVING COUNT(*) > 1
) d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_predicciones_ml_org_producto_botica_periodo_modelo_unique
  ON public.predicciones_ml(org_id, producto_id, botica_id, periodo_inicio, modelo_version_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_ml_org_botica_producto_periodo
  ON public.predicciones_ml(org_id, botica_id, producto_id, periodo_inicio);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inferencias_org_producto_botica_fecha_modelo_unique
  ON public.inferencias(org_id, producto_id, botica_id, fecha_pred, modelo_version_id);
CREATE INDEX IF NOT EXISTS idx_inferencias_org_fecha_pred
  ON public.inferencias(org_id, fecha_pred);
CREATE INDEX IF NOT EXISTS idx_alertas_ml_org_tipo_urgencia
  ON public.alertas_ml(org_id, tipo, urgencia);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_ml_org_tipo_estado
  ON public.recomendaciones_ml(org_id, tipo_recomendacion, estado);
CREATE INDEX IF NOT EXISTS idx_drift_metricas_org_fecha
  ON public.drift_metricas(org_id, fecha_calculo);

CREATE OR REPLACE FUNCTION public.validar_prediccion_ml_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_botica uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  SELECT org_id INTO v_org_botica FROM public.boticas WHERE id = NEW.botica_id;
  IF v_org_producto IS NULL OR v_org_botica IS NULL OR v_org_producto <> v_org_botica THEN
    RAISE EXCEPTION 'Prediccion ML cruza organizaciones o referencia entidades inexistentes';
  END IF;
  IF NEW.org_id IS NULL THEN NEW.org_id := v_org_producto; END IF;
  IF NEW.org_id <> v_org_producto THEN RAISE EXCEPTION 'org_id de prediccion ML no coincide'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_inferencia_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_botica uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  SELECT org_id INTO v_org_botica FROM public.boticas WHERE id = NEW.botica_id;
  IF v_org_producto IS NULL OR v_org_botica IS NULL OR v_org_producto <> v_org_botica THEN
    RAISE EXCEPTION 'Inferencia cruza organizaciones o referencia entidades inexistentes';
  END IF;
  IF NEW.org_id IS NULL THEN NEW.org_id := v_org_producto; END IF;
  IF NEW.org_id <> v_org_producto THEN RAISE EXCEPTION 'org_id de inferencia no coincide'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_alerta_ml_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_botica uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  SELECT org_id INTO v_org_botica FROM public.boticas WHERE id = NEW.botica_id;
  IF v_org_producto IS NULL OR v_org_botica IS NULL OR v_org_producto <> v_org_botica THEN
    RAISE EXCEPTION 'Alerta ML cruza organizaciones o referencia entidades inexistentes';
  END IF;
  IF NEW.org_id IS NULL THEN NEW.org_id := v_org_producto; END IF;
  IF NEW.org_id <> v_org_producto THEN RAISE EXCEPTION 'org_id de alerta ML no coincide'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_recomendacion_ml_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_producto uuid;
  v_org_destino uuid;
  v_org_origen uuid;
  v_org_proveedor uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM public.productos WHERE id = NEW.producto_id;
  SELECT org_id INTO v_org_destino FROM public.boticas WHERE id = COALESCE(NEW.botica_id, NEW.botica_destino_id);
  IF NEW.botica_origen_id IS NOT NULL THEN SELECT org_id INTO v_org_origen FROM public.boticas WHERE id = NEW.botica_origen_id; END IF;
  IF NEW.proveedor_id IS NOT NULL THEN SELECT org_id INTO v_org_proveedor FROM public.proveedores WHERE id = NEW.proveedor_id; END IF;
  IF v_org_producto IS NULL OR v_org_destino IS NULL OR v_org_producto <> v_org_destino THEN
    RAISE EXCEPTION 'Recomendacion ML cruza organizaciones o referencia entidades inexistentes';
  END IF;
  IF v_org_origen IS NOT NULL AND v_org_origen <> v_org_producto THEN RAISE EXCEPTION 'Botica origen de recomendacion pertenece a otra organizacion'; END IF;
  IF v_org_proveedor IS NOT NULL AND v_org_proveedor <> v_org_producto THEN RAISE EXCEPTION 'Proveedor de recomendacion pertenece a otra organizacion'; END IF;
  IF NEW.org_id IS NULL THEN NEW.org_id := v_org_producto; END IF;
  IF NEW.botica_id IS NULL THEN NEW.botica_id := NEW.botica_destino_id; END IF;
  IF NEW.org_id <> v_org_producto THEN RAISE EXCEPTION 'org_id de recomendacion ML no coincide'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prediccion_ml_misma_org ON public.predicciones_ml;
CREATE TRIGGER trg_prediccion_ml_misma_org BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id ON public.predicciones_ml
  FOR EACH ROW EXECUTE FUNCTION public.validar_prediccion_ml_misma_org();
DROP TRIGGER IF EXISTS trg_inferencia_misma_org ON public.inferencias;
CREATE TRIGGER trg_inferencia_misma_org BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id ON public.inferencias
  FOR EACH ROW EXECUTE FUNCTION public.validar_inferencia_misma_org();
DROP TRIGGER IF EXISTS trg_alerta_ml_misma_org ON public.alertas_ml;
CREATE TRIGGER trg_alerta_ml_misma_org BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id ON public.alertas_ml
  FOR EACH ROW EXECUTE FUNCTION public.validar_alerta_ml_misma_org();
DROP TRIGGER IF EXISTS trg_recomendacion_ml_misma_org ON public.recomendaciones_ml;
CREATE TRIGGER trg_recomendacion_ml_misma_org BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id, botica_destino_id, botica_origen_id, proveedor_id ON public.recomendaciones_ml
  FOR EACH ROW EXECUTE FUNCTION public.validar_recomendacion_ml_misma_org();

COMMENT ON COLUMN public.predicciones_ml.cantidad_predicha IS
  'Prediccion final del modelo hibrido V4: cantidad_predicha = prediccion_hibrida.';
COMMENT ON COLUMN public.predicciones_ml.intervalo_sup IS
  'Intervalo superior opcional. Nullable porque el modelo V4 actual no produce intervalos probabilisticos reales.';
COMMENT ON COLUMN public.predicciones_ml.intervalosup IS
  'DEPRECADO temporalmente: usar intervalo_sup. Se conserva por compatibilidad con servicios existentes.';
COMMENT ON COLUMN public.recomendaciones_ml.metadata_jsonb IS
  'Detalle flexible para recomendaciones de compra, transferencia interna o sin accion.';
COMMENT ON COLUMN public.alertas_ml.metadata_jsonb IS
  'Detalle flexible para frontend y trazabilidad de alertas ML.';

-- ============================================================
-- Importaciones permitidas
-- ============================================================
ALTER TABLE public.importaciones_datos DROP CONSTRAINT IF EXISTS importaciones_datos_tipo_importacion_check;
ALTER TABLE public.importaciones_datos
  ADD CONSTRAINT importaciones_datos_tipo_importacion_check CHECK (tipo_importacion IN (
    'categorias_terapeuticas', 'boticas', 'productos', 'proveedores',
    'usuarios', 'proveedor_producto', 'precios', 'stock_inicial', 'ventas_historicas'
  ));

-- ============================================================
-- Vista semanal ML: series relevantes x calendario semanal
-- ============================================================
CREATE OR REPLACE VIEW public.vw_demanda_semanal_ml
WITH (security_invoker = true) AS
WITH ventas_semana AS (
  SELECT
    date_trunc('week', vh.fecha_venta)::date AS fecha_semana,
    vh.org_id,
    vh.botica_id,
    vh.producto_id,
    SUM(vh.cantidad)::double precision AS cantidad_vendida
  FROM public.ventas_historicas vh
  GROUP BY 1, 2, 3, 4
), rango_series AS (
  SELECT org_id, botica_id, producto_id, MIN(fecha_semana) AS semana_inicio, MAX(fecha_semana) AS semana_fin
  FROM ventas_semana
  GROUP BY 1, 2, 3
), series_relevantes AS (
  SELECT rs.org_id, rs.botica_id, rs.producto_id, rs.semana_inicio, GREATEST(rs.semana_fin, date_trunc('week', now())::date) AS semana_fin
  FROM rango_series rs
  JOIN public.productos p ON p.id = rs.producto_id AND p.org_id = rs.org_id AND p.estado = 'activo'
  JOIN public.boticas b ON b.id = rs.botica_id AND b.org_id = rs.org_id AND b.activa AND b.tipo = 'botica'
), calendario AS (
  SELECT
    s.org_id,
    s.botica_id,
    s.producto_id,
    generate_series(s.semana_inicio, s.semana_fin, interval '1 week')::date AS fecha_semana
  FROM series_relevantes s
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
  SELECT
    pp.*,
    ROW_NUMBER() OVER (
      PARTITION BY pp.org_id, pp.producto_id
      ORDER BY pp.lead_time_dias NULLS LAST, pp.precio_referencial NULLS LAST, pp.id
    ) AS rn
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
  0::double precision AS demanda_insatisfecha,
  CASE WHEN COALESCE(s.stock_inicio_semana, su.cantidad_disponible, 0) <= 0 AND COALESCE(v.cantidad_vendida, 0) > 0 THEN 1 ELSE 0 END::integer AS stockout_flag,
  COALESCE(s.stock_inicio_semana, su.cantidad_disponible, 0)::double precision AS stock_inicio_semana,
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

COMMENT ON VIEW public.vw_demanda_semanal_ml IS
  'Vista ML security_invoker=true. Serie relevante = producto activo + botica activa tipo botica con al menos una venta historica; se completa calendario semanal con COALESCE a cero. El proveedor se elige deterministamente por activo, menor lead_time_dias, menor precio_referencial e id.';

-- ============================================================
-- RLS multiempresa
-- ============================================================
ALTER TABLE public.categorias_terapeuticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predicciones_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recomendaciones_ml ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access" ON public.categorias_terapeuticas;
DROP POLICY IF EXISTS "operador_select_categorias" ON public.categorias_terapeuticas;
DROP POLICY IF EXISTS "visor_select_categorias" ON public.categorias_terapeuticas;
CREATE POLICY "admin_full_access" ON public.categorias_terapeuticas FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_select_categorias" ON public.categorias_terapeuticas FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_categorias" ON public.categorias_terapeuticas FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.proveedor_producto;
DROP POLICY IF EXISTS "operador_prov_producto" ON public.proveedor_producto;
DROP POLICY IF EXISTS "visor_select_prov_producto" ON public.proveedor_producto;
CREATE POLICY "admin_full_access" ON public.proveedor_producto FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_prov_producto" ON public.proveedor_producto FOR ALL
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario())
  WITH CHECK (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_prov_producto" ON public.proveedor_producto FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.precios;
DROP POLICY IF EXISTS "operador_precios" ON public.precios;
DROP POLICY IF EXISTS "visor_select_precios" ON public.precios;
CREATE POLICY "admin_full_access" ON public.precios FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_precios" ON public.precios FOR ALL
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario())
  WITH CHECK (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_precios" ON public.precios FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND (botica_id = public.obtener_botica_usuario() OR botica_id IS NULL));

DROP POLICY IF EXISTS "admin_full_access" ON public.predicciones_ml;
DROP POLICY IF EXISTS "operador_predicciones" ON public.predicciones_ml;
DROP POLICY IF EXISTS "visor_select_predicciones" ON public.predicciones_ml;
CREATE POLICY "admin_full_access" ON public.predicciones_ml FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_predicciones" ON public.predicciones_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_predicciones" ON public.predicciones_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND botica_id = public.obtener_botica_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.inferencias;
DROP POLICY IF EXISTS "operador_inferencias" ON public.inferencias;
DROP POLICY IF EXISTS "visor_select_inferencias" ON public.inferencias;
CREATE POLICY "admin_full_access" ON public.inferencias FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_inferencias" ON public.inferencias FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_inferencias" ON public.inferencias FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND botica_id = public.obtener_botica_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.drift_metricas;
DROP POLICY IF EXISTS "operador_select_drift" ON public.drift_metricas;
DROP POLICY IF EXISTS "visor_select_drift" ON public.drift_metricas;
CREATE POLICY "admin_full_access" ON public.drift_metricas FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_select_drift" ON public.drift_metricas FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_drift" ON public.drift_metricas FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.alertas_ml;
DROP POLICY IF EXISTS "operador_alertas" ON public.alertas_ml;
DROP POLICY IF EXISTS "visor_select_alertas" ON public.alertas_ml;
CREATE POLICY "admin_full_access" ON public.alertas_ml FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_alertas" ON public.alertas_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_alertas" ON public.alertas_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND botica_id = public.obtener_botica_usuario());

DROP POLICY IF EXISTS "admin_full_access" ON public.recomendaciones_ml;
DROP POLICY IF EXISTS "operador_recomendaciones" ON public.recomendaciones_ml;
DROP POLICY IF EXISTS "visor_select_recomendaciones" ON public.recomendaciones_ml;
CREATE POLICY "admin_full_access" ON public.recomendaciones_ml FOR ALL
  USING (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()))
  WITH CHECK (public.obtener_rol_usuario() = 'super_admin' OR (public.obtener_rol_usuario() = 'admin_central' AND org_id = public.obtener_org_usuario()));
CREATE POLICY "operador_recomendaciones" ON public.recomendaciones_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'operador_drogueria' AND org_id = public.obtener_org_usuario());
CREATE POLICY "visor_select_recomendaciones" ON public.recomendaciones_ml FOR SELECT
  USING (public.obtener_rol_usuario() = 'visor_botica' AND org_id = public.obtener_org_usuario() AND (botica_id = public.obtener_botica_usuario() OR botica_destino_id = public.obtener_botica_usuario() OR botica_origen_id = public.obtener_botica_usuario()));

-- ============================================================
-- Auditoria para acciones sensibles de super_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.auditar_accion_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_entidad_id uuid;
BEGIN
  IF public.obtener_rol_usuario() <> 'super_admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_org_id := COALESCE((to_jsonb(NEW)->>'org_id')::uuid, (to_jsonb(OLD)->>'org_id')::uuid, public.obtener_org_usuario());
  v_entidad_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);

  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle, metadata_jsonb)
    VALUES (
      v_org_id,
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      v_entidad_id,
      'info',
      'Accion sensible ejecutada por super_admin',
      jsonb_build_object('tabla', TG_TABLE_NAME, 'operacion', TG_OP)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['categorias_terapeuticas','proveedor_producto','precios','predicciones_ml','inferencias','drift_metricas','alertas_ml','recomendaciones_ml']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar_super_admin_%I ON public.%I', v_tabla, v_tabla);
    EXECUTE format('CREATE TRIGGER trg_auditar_super_admin_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auditar_accion_super_admin()', v_tabla, v_tabla);
  END LOOP;
END $$;

COMMIT;
