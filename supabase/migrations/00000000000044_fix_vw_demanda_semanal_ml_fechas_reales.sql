-- ============================================================
-- Migracion 44: corregir vw_demanda_semanal_ml
-- La vista original usaba:
--   GREATEST(rs.semana_fin, date_trunc('week', now())::date)
-- que extiende el calendario hasta CURRENT_DATE, creando
-- semanas artificiales con ventas cero.
--
-- El fix calcula el rango por org_id desde los datos reales:
--   date_trunc('week', MIN(fecha_venta))
--   date_trunc('week', MAX(fecha_venta))
-- Sin usar CURRENT_DATE en ningun lado.
-- ============================================================

BEGIN;

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
), rango_semanas AS (
  SELECT
    org_id,
    date_trunc('week', MIN(fecha_venta))::date AS semana_inicio,
    date_trunc('week', MAX(fecha_venta))::date AS semana_fin
  FROM public.ventas_historicas
  GROUP BY org_id
), series_relevantes AS (
  SELECT DISTINCT
    vh.org_id,
    vh.botica_id,
    vh.producto_id
  FROM public.ventas_historicas vh
  JOIN public.productos p ON p.id = vh.producto_id AND p.org_id = vh.org_id AND p.estado = 'activo'
  JOIN public.boticas b ON b.id = vh.botica_id AND b.org_id = vh.org_id AND b.activa AND b.tipo = 'botica'
), calendario AS (
  SELECT
    sr.org_id,
    sr.botica_id,
    sr.producto_id,
    generate_series(rs.semana_inicio, rs.semana_fin, interval '1 week')::date AS fecha_semana
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
  'Vista ML security_invoker=true. Rango de fechas por org_id desde MIN/MAX(fecha_venta) sin CURRENT_DATE. Grilla completa org_id x botica_id x producto_id x fecha_semana con COALESCE a cero.';

COMMIT;
