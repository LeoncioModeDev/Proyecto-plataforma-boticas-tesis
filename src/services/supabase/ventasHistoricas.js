import { supabase } from './cliente'

const VISTA = 'vw_ventas_historicas_importadas'

function aplicarFiltros(query, filtros = {}) {
  if (filtros.boticaId) query = query.eq('botica_id', filtros.boticaId)
  if (filtros.productoId) query = query.eq('producto_id', filtros.productoId)
  if (filtros.categoria) query = query.eq('categoria_terapeutica', filtros.categoria)
  if (filtros.importacionId) query = query.eq('importacion_id', filtros.importacionId)
  if (filtros.fechaDesde) query = query.gte('fecha_venta', filtros.fechaDesde)
  if (filtros.fechaHasta) query = query.lte('fecha_venta', filtros.fechaHasta)
  if (filtros.busqueda) {
    const termino = filtros.busqueda.replaceAll(',', ' ').trim()
    if (termino) query = query.or(`codigo_producto.ilike.%${termino}%,producto.ilike.%${termino}%`)
  }
  return query
}

function aplicarPaginacion(query, filtros = {}) {
  const pagina = Math.max(Number(filtros.pagina || 1), 1)
  const limite = Math.max(Number(filtros.limite || 20), 1)
  const desde = (pagina - 1) * limite
  return query.range(desde, desde + limite - 1)
}

function calcularResumen(datos, total) {
  const unidades = datos.reduce((acc, item) => acc + Number(item.cantidad || 0), 0)
  const productos = new Set(datos.map(item => item.producto_id).filter(Boolean)).size
  const boticas = new Set(datos.map(item => item.botica_id).filter(Boolean)).size
  const fechas = datos.map(item => item.fecha_venta).filter(Boolean).sort()
  return {
    totalRegistros: total,
    totalUnidades: unidades,
    productosConVentas: productos,
    boticasConVentas: boticas,
    rangoHistorico: fechas.length ? `${fechas[0]} - ${fechas[fechas.length - 1]}` : 'Sin datos',
  }
}

const COLUMNAS = 'fecha_venta,botica_id,botica,codigo_producto,producto_id,producto,categoria_terapeutica,cantidad,precio_unitario,importacion_id,fecha_importacion'

export async function listarVentasHistoricasImportadas(filtros = {}) {
  const ordenCampo = filtros.ordenCampo || 'fecha_venta'
  const ascendente = filtros.ascendente === true
  let query = supabase.from(VISTA).select(COLUMNAS, { count: 'estimated', head: false })
  query = aplicarFiltros(query, filtros)
  const tieneFiltros = filtros.busqueda || filtros.boticaId || filtros.productoId || filtros.categoria || filtros.importacionId || filtros.fechaDesde || filtros.fechaHasta
  const orden = tieneFiltros ? query.order(ordenCampo, { ascending: ascendente }).order('producto', { ascending: true }) : query.order(ordenCampo, { ascending: ascendente })
  query = aplicarPaginacion(orden, filtros)

  const { data, count, error } = await query
  if (error) throw new Error('Error al cargar ventas historicas importadas: ' + error.message)
  const datos = data || []
  return { datos, total: count || 0, resumen: calcularResumen(datos, count || 0) }
}
