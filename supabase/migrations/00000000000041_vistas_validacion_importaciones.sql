-- ============================================================
-- Migracion 41: vistas de validacion de datos importados
-- ============================================================

BEGIN;

CREATE OR REPLACE VIEW public.vw_precios_importados
WITH (security_invoker = true) AS
SELECT
  pr.org_id,
  pr.botica_id,
  pr.producto_id,
  b.codigo_interno AS codigo_botica,
  COALESCE(b.nombre, 'Drogueria central') AS botica,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial AS producto,
  COALESCE(ct.nombre, p.categoria_terapeutica, p.clasificacion::text, 'Sin categoria') AS categoria_terapeutica,
  pr.precio_venta,
  pr.precio_costo,
  (pr.precio_venta - pr.precio_costo) AS margen,
  pr.vigente_desde,
  pr.vigente_hasta,
  CASE
    WHEN pr.vigente_desde > now() THEN 'Programado'
    WHEN pr.vigente_hasta IS NOT NULL AND pr.vigente_hasta < now() THEN 'Vencido'
    ELSE 'Vigente'
  END AS estado_vigencia
FROM public.precios pr
JOIN public.productos p ON p.id = pr.producto_id AND p.org_id = pr.org_id
LEFT JOIN public.boticas b ON b.id = pr.botica_id AND b.org_id = pr.org_id
LEFT JOIN public.categorias_terapeuticas ct ON ct.id = p.categoria_terapeutica_id AND ct.org_id = p.org_id;

COMMENT ON VIEW public.vw_precios_importados IS
  'Vista read-only security_invoker=true para validar precios importados. No expone precio_referencial de proveedor_producto.';

CREATE OR REPLACE VIEW public.vw_ventas_historicas_importadas
WITH (security_invoker = true) AS
SELECT
  vh.org_id,
  vh.botica_id,
  vh.producto_id,
  b.codigo_interno AS codigo_botica,
  b.nombre AS botica,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial AS producto,
  COALESCE(ct.nombre, p.categoria_terapeutica, p.clasificacion::text, 'Sin categoria') AS categoria_terapeutica,
  vh.fecha_venta,
  vh.cantidad,
  vh.precio_unitario,
  vh.importacion_id,
  i.created_at AS fecha_importacion
FROM public.ventas_historicas vh
JOIN public.productos p ON p.id = vh.producto_id AND p.org_id = vh.org_id
JOIN public.boticas b ON b.id = vh.botica_id AND b.org_id = vh.org_id
LEFT JOIN public.categorias_terapeuticas ct ON ct.id = p.categoria_terapeutica_id AND ct.org_id = p.org_id
LEFT JOIN public.importaciones_datos i ON i.id = vh.importacion_id AND i.org_id = vh.org_id;

COMMENT ON VIEW public.vw_ventas_historicas_importadas IS
  'Vista read-only security_invoker=true para validar ventas historicas importadas antes de ejecutar ML.';

CREATE OR REPLACE VIEW public.vw_stock_historico_importado
WITH (security_invoker = true) AS
SELECT
  sh.org_id,
  sh.ubicacion_id AS botica_id,
  sh.producto_id,
  b.codigo_interno AS codigo_botica,
  COALESCE(b.nombre, 'Drogueria central') AS botica,
  p.codigo_interno AS codigo_producto,
  p.nombre_comercial AS producto,
  COALESCE(ct.nombre, p.categoria_terapeutica, p.clasificacion::text, 'Sin categoria') AS categoria_terapeutica,
  sh.fecha_snapshot_dia AS fecha_snapshot,
  sh.cantidad_disponible,
  sh.stock_minimo,
  sh.stock_maximo,
  sh.stockout_flag,
  sh.demanda_insatisfecha
FROM public.stock_historico sh
JOIN public.productos p ON p.id = sh.producto_id AND p.org_id = sh.org_id
LEFT JOIN public.boticas b ON b.id = sh.ubicacion_id AND b.org_id = sh.org_id
LEFT JOIN public.categorias_terapeuticas ct ON ct.id = p.categoria_terapeutica_id AND ct.org_id = p.org_id;

COMMENT ON VIEW public.vw_stock_historico_importado IS
  'Vista read-only security_invoker=true para validar snapshots historicos de inventario importados. No representa stock operativo actual.';

COMMIT;
