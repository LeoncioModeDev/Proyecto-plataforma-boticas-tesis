-- ============================================================
-- Migracion 34: Vistas productivas ML sin duplicar tablas
-- Reutiliza predicciones_ml, alertas_ml, recomendaciones_ml y modelos_ml.
-- ============================================================

BEGIN;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS principio_activo text,
  ADD COLUMN IF NOT EXISTS categoria_terapeutica text,
  ADD COLUMN IF NOT EXISTS forma_farmaceutica text,
  ADD COLUMN IF NOT EXISTS concentracion text,
  ADD COLUMN IF NOT EXISTS requiere_receta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unidad_medida_id uuid REFERENCES unidades_medida(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE proveedor_producto
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS lead_time_dias integer,
  ADD COLUMN IF NOT EXISTS precio_referencial numeric(10,2),
  ADD COLUMN IF NOT EXISTS moneda_id uuid REFERENCES monedas(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE proveedor_producto pp
SET org_id = p.org_id
FROM productos p
WHERE pp.org_id IS NULL
  AND pp.producto_id = p.id;

UPDATE proveedor_producto
SET lead_time_dias = lead_time_especifico
WHERE lead_time_dias IS NULL
  AND lead_time_especifico IS NOT NULL;

UPDATE proveedor_producto
SET precio_referencial = COALESCE(precio_compra_referencial, precio_compra)
WHERE precio_referencial IS NULL;

ALTER TABLE precios
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS moneda_id uuid REFERENCES monedas(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE precios pr
SET org_id = p.org_id
FROM productos p
WHERE pr.org_id IS NULL
  AND pr.producto_id = p.id;

CREATE INDEX IF NOT EXISTS idx_proveedor_producto_org_producto
  ON proveedor_producto(org_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_precios_org_producto_botica
  ON precios(org_id, producto_id, botica_id, vigente_desde);
CREATE INDEX IF NOT EXISTS idx_predicciones_ml_org_objetivo
  ON predicciones_ml(org_id, botica_id, producto_id, periodo_inicio);
CREATE INDEX IF NOT EXISTS idx_alertas_ml_org_tipo
  ON alertas_ml(org_id, tipo, urgencia);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_ml_org_tipo_estado
  ON recomendaciones_ml(org_id, tipo_recomendacion, estado);

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
  COALESCE(p.categoria_terapeutica, p.clasificacion::text) AS categoria_terapeutica,
  v.cantidad_vendida,
  0::float AS demanda_insatisfecha,
  0::int AS stockout_flag,
  COALESCE(s.stock_inicio_semana, su.cantidad_disponible, 0)::float AS stock_inicio_semana,
  COALESCE(s.stock_minimo, su.stock_minimo, 0)::float AS stock_minimo,
  COALESCE(s.stock_maximo, su.stock_maximo, 0)::float AS stock_maximo,
  COALESCE(pp.lead_time_dias, pp.lead_time_especifico, 7)::int AS lead_time_dias
FROM ventas_semana v
JOIN productos p ON p.id = v.producto_id AND p.org_id = v.org_id
LEFT JOIN stock_semana s ON s.org_id = v.org_id AND s.botica_id = v.botica_id AND s.producto_id = v.producto_id AND s.fecha_semana = v.fecha_semana
LEFT JOIN stock_ubicaciones su ON su.producto_id = v.producto_id AND su.ubicacion_id = v.botica_id
LEFT JOIN proveedor_producto pp ON pp.org_id = v.org_id AND pp.producto_id = v.producto_id AND COALESCE(pp.activo, true);

CREATE OR REPLACE VIEW vw_predicciones_demanda
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.org_id,
  p.botica_id,
  p.producto_id,
  p.generado_en AS fecha_generacion,
  p.periodo_inicio AS fecha_objetivo,
  NULL::integer AS horizonte,
  p.cantidad_predicha AS prediccion_hibrida,
  p.estrategia AS metodo_aplicado,
  p.nivel_madurez,
  m.version AS version_modelo,
  p.generado_en AS created_at
FROM predicciones_ml p
LEFT JOIN modelos_ml m ON m.id = p.modelo_version_id;

CREATE OR REPLACE VIEW vw_alertas_inventario
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.org_id,
  a.botica_id,
  a.producto_id,
  NULL::uuid AS lote_id,
  a.tipo::text AS tipo_alerta,
  a.urgencia::text AS nivel_urgencia,
  a.mensaje,
  a.generado_en AS fecha_generacion,
  NULL::date AS fecha_vencimiento,
  NULL::float AS stock_actual,
  NULL::float AS stock_proyectado,
  NULL::float AS cantidad_recomendada,
  CASE WHEN a.resuelta THEN 'resuelta' ELSE 'pendiente' END AS estado,
  m.version AS version_modelo,
  a.generado_en AS created_at
FROM alertas_ml a
LEFT JOIN modelos_ml m ON m.id = a.modelo_version_id;

CREATE OR REPLACE VIEW vw_recomendaciones_reposicion
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.org_id,
  r.botica_id,
  r.producto_id,
  r.proveedor_id,
  r.generado_en AS fecha_generacion,
  r.lead_time_dias AS horizonte_dias,
  r.demanda_durante_lead_time AS demanda_pronosticada,
  r.stock_disponible AS stock_actual,
  r.stock_seguridad,
  COALESCE(r.cantidad_final, r.cantidad_sugerida)::float AS cantidad_recomendada,
  r.precio_referencial,
  (COALESCE(r.cantidad_final, r.cantidad_sugerida)::numeric * COALESCE(r.precio_referencial, 0)) AS costo_estimado,
  COALESCE(r.datos_jsonb->>'prioridad', r.datos_jsonb->>'nivel_urgencia', 'MEDIA') AS nivel_urgencia,
  r.estado::text,
  m.version AS version_modelo,
  r.generado_en AS created_at
FROM recomendaciones_ml r
LEFT JOIN modelos_ml m ON m.id = r.modelo_version_id;

COMMENT ON VIEW vw_demanda_semanal_ml IS 'Vista semanal equivalente a features_entrenamiento.csv. En produccion es la fuente Supabase para ML.';
COMMENT ON VIEW vw_predicciones_demanda IS 'Vista de compatibilidad sobre predicciones_ml para lectura de demanda pronosticada multiempresa.';
COMMENT ON VIEW vw_alertas_inventario IS 'Vista de compatibilidad sobre alertas_ml para lectura de alertas operativas multiempresa.';
COMMENT ON VIEW vw_recomendaciones_reposicion IS 'Vista de compatibilidad sobre recomendaciones_ml para lectura de recomendaciones de reposicion multiempresa.';

COMMENT ON VIEW vw_demanda_semanal_ml IS 'Vista semanal ML con security_invoker=true: la lectura se ejecuta como usuario invocador y hereda RLS por org_id de ventas_historicas, productos, stock_historico, stock_ubicaciones y proveedor_producto.';
COMMENT ON VIEW vw_predicciones_demanda IS 'Vista de compatibilidad sobre predicciones_ml con security_invoker=true; hereda RLS por org_id de predicciones_ml y modelos_ml.';
COMMENT ON VIEW vw_alertas_inventario IS 'Vista de compatibilidad sobre alertas_ml con security_invoker=true; hereda RLS por org_id de alertas_ml y modelos_ml.';
COMMENT ON VIEW vw_recomendaciones_reposicion IS 'Vista de compatibilidad sobre recomendaciones_ml con security_invoker=true; hereda RLS por org_id de recomendaciones_ml y modelos_ml.';

COMMIT;
