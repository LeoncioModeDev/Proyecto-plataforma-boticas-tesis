-- ============================================================
-- Migracion 35: Categorias terapeuticas normalizadas e importacion relacional
-- No crea organizaciones ni permite org_id manual en plantillas.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS categorias_terapeuticas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  codigo      text NOT NULL,
  nombre      text NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  modified_by uuid REFERENCES usuarios(id)
);

CREATE OR REPLACE FUNCTION normalizar_categoria_terapeutica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.codigo := upper(trim(NEW.codigo));
  NEW.nombre := trim(NEW.nombre);
  NEW.descripcion := nullif(trim(coalesce(NEW.descripcion, '')), '');

  IF NEW.codigo = '' THEN
    RAISE EXCEPTION 'El codigo de categoria terapeutica no puede estar vacio';
  END IF;

  IF NEW.nombre = '' THEN
    RAISE EXCEPTION 'El nombre de categoria terapeutica no puede estar vacio';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.modified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_categoria_terapeutica ON categorias_terapeuticas;
CREATE TRIGGER trg_normalizar_categoria_terapeutica
  BEFORE INSERT OR UPDATE ON categorias_terapeuticas
  FOR EACH ROW EXECUTE FUNCTION normalizar_categoria_terapeutica();

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_terapeuticas_org_codigo
  ON categorias_terapeuticas(org_id, codigo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_terapeuticas_org_nombre_lower
  ON categorias_terapeuticas(org_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_categorias_terapeuticas_org_activo
  ON categorias_terapeuticas(org_id, activo);

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS categoria_terapeutica_id uuid REFERENCES categorias_terapeuticas(id);

CREATE INDEX IF NOT EXISTS idx_productos_org_categoria_terapeutica
  ON productos(org_id, categoria_terapeutica_id);

CREATE OR REPLACE FUNCTION validar_producto_categoria_misma_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_categoria uuid;
BEGIN
  IF NEW.categoria_terapeutica_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id INTO v_org_categoria
  FROM categorias_terapeuticas
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

DROP TRIGGER IF EXISTS trg_producto_categoria_misma_org ON productos;
CREATE TRIGGER trg_producto_categoria_misma_org
  BEFORE INSERT OR UPDATE OF org_id, categoria_terapeutica_id ON productos
  FOR EACH ROW EXECUTE FUNCTION validar_producto_categoria_misma_org();

ALTER TABLE categorias_terapeuticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access" ON categorias_terapeuticas;
DROP POLICY IF EXISTS "operador_select_categorias" ON categorias_terapeuticas;
DROP POLICY IF EXISTS "visor_select_categorias" ON categorias_terapeuticas;

CREATE POLICY "admin_full_access" ON categorias_terapeuticas FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  )
  WITH CHECK (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND org_id = obtener_org_usuario())
  );

CREATE POLICY "operador_select_categorias" ON categorias_terapeuticas FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

CREATE POLICY "visor_select_categorias" ON categorias_terapeuticas FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

ALTER TABLE proveedor_producto
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS lead_time_dias integer,
  ADD COLUMN IF NOT EXISTS precio_referencial numeric(10,2),
  ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multiplo_empaque integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE proveedor_producto pp
SET org_id = p.org_id
FROM productos p
WHERE pp.org_id IS NULL
  AND pp.producto_id = p.id;

ALTER TABLE proveedor_producto
  ALTER COLUMN org_id SET NOT NULL;

UPDATE proveedor_producto
SET lead_time_dias = lead_time_especifico
WHERE lead_time_dias IS NULL
  AND lead_time_especifico IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proveedor_producto'
      AND column_name = 'precio_compra_referencial'
  ) THEN
    EXECUTE '
      UPDATE proveedor_producto
      SET precio_referencial = precio_compra_referencial
      WHERE precio_referencial IS NULL
        AND precio_compra_referencial IS NOT NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proveedor_producto'
      AND column_name = 'precio_compra'
  ) THEN
    EXECUTE '
      UPDATE proveedor_producto
      SET precio_referencial = precio_compra
      WHERE precio_referencial IS NULL
        AND precio_compra IS NOT NULL
    ';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_lead_time_dias') THEN
    ALTER TABLE proveedor_producto
      ADD CONSTRAINT chk_proveedor_producto_lead_time_dias CHECK (lead_time_dias IS NULL OR lead_time_dias >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_precio_referencial') THEN
    ALTER TABLE proveedor_producto
      ADD CONSTRAINT chk_proveedor_producto_precio_referencial CHECK (precio_referencial IS NULL OR precio_referencial >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE precios
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE precios pr
SET org_id = p.org_id
FROM productos p
WHERE pr.org_id IS NULL
  AND pr.producto_id = p.id;

ALTER TABLE precios
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_precios_org_producto_botica_vigencia
  ON precios(org_id, producto_id, botica_id, vigente_desde);

CREATE OR REPLACE FUNCTION validar_precio_misma_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_producto uuid;
  v_org_botica uuid;
BEGIN
  SELECT org_id INTO v_org_producto FROM productos WHERE id = NEW.producto_id;
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
    SELECT org_id INTO v_org_botica FROM boticas WHERE id = NEW.botica_id;
    IF v_org_botica IS NULL OR v_org_botica <> NEW.org_id THEN
      RAISE EXCEPTION 'La botica del precio pertenece a otra organizacion';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_precio_misma_org ON precios;
CREATE TRIGGER trg_precio_misma_org
  BEFORE INSERT OR UPDATE OF org_id, producto_id, botica_id ON precios
  FOR EACH ROW EXECUTE FUNCTION validar_precio_misma_org();

ALTER TABLE importaciones_datos DROP CONSTRAINT IF EXISTS importaciones_datos_tipo_importacion_check;
ALTER TABLE importaciones_datos
  ADD CONSTRAINT importaciones_datos_tipo_importacion_check CHECK (tipo_importacion IN (
    'categorias_terapeuticas', 'boticas', 'productos', 'proveedores',
    'usuarios', 'proveedor_producto', 'precios', 'stock_inicial', 'ventas_historicas'
  ));

CREATE OR REPLACE VIEW vw_demanda_semanal_ml
WITH (security_invoker = true) AS
WITH ventas_semana AS (
  SELECT
    date_trunc('week', vh.fecha_venta)::date AS fecha_semana,
    vh.org_id,
    vh.botica_id,
    vh.producto_id,
    SUM(vh.cantidad)::float AS cantidad_vendida
  FROM ventas_historicas vh
  GROUP BY 1, 2, 3, 4
), stock_semana AS (
  SELECT DISTINCT ON (sh.org_id, sh.ubicacion_id, sh.producto_id, date_trunc('week', sh.fecha_snapshot_dia)::date)
    date_trunc('week', sh.fecha_snapshot_dia)::date AS fecha_semana,
    sh.org_id,
    sh.ubicacion_id AS botica_id,
    sh.producto_id,
    sh.cantidad_disponible AS stock_inicio_semana,
    sh.stock_minimo,
    sh.stock_maximo
  FROM stock_historico sh
  ORDER BY sh.org_id, sh.ubicacion_id, sh.producto_id, date_trunc('week', sh.fecha_snapshot_dia)::date, sh.fecha_snapshot_dia
)
SELECT
  v.fecha_semana,
  v.org_id,
  v.botica_id,
  v.producto_id,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial,
  ct.nombre AS categoria_terapeutica,
  v.cantidad_vendida,
  0::float AS demanda_insatisfecha,
  0::int AS stockout_flag,
  COALESCE(s.stock_inicio_semana, su.cantidad_disponible, 0)::float AS stock_inicio_semana,
  COALESCE(s.stock_minimo, su.stock_minimo, 0)::float AS stock_minimo,
  COALESCE(s.stock_maximo, su.stock_maximo, 0)::float AS stock_maximo,
  COALESCE(pp.lead_time_dias, pp.lead_time_especifico, 7)::int AS lead_time_dias
FROM ventas_semana v
JOIN productos p ON p.id = v.producto_id AND p.org_id = v.org_id
LEFT JOIN categorias_terapeuticas ct ON ct.id = p.categoria_terapeutica_id AND ct.org_id = p.org_id
LEFT JOIN stock_semana s ON s.org_id = v.org_id AND s.botica_id = v.botica_id AND s.producto_id = v.producto_id AND s.fecha_semana = v.fecha_semana
LEFT JOIN stock_ubicaciones su ON su.org_id = v.org_id AND su.producto_id = v.producto_id AND su.ubicacion_id = v.botica_id
LEFT JOIN proveedor_producto pp ON pp.org_id = v.org_id AND pp.producto_id = v.producto_id AND COALESCE(pp.activo, true);

COMMENT ON TABLE categorias_terapeuticas IS 'Catalogo normalizado de categorias terapeuticas por organizacion. Los usuarios importan por codigo, no por UUID.';
COMMENT ON COLUMN productos.categoria_terapeutica_id IS 'Categoria terapeutica normalizada. Nullable para migracion segura de productos existentes.';
COMMENT ON VIEW vw_demanda_semanal_ml IS 'Vista semanal ML con categoria_terapeutica desde categorias_terapeuticas.nombre y security_invoker=true para heredar RLS por org_id.';

COMMIT;
