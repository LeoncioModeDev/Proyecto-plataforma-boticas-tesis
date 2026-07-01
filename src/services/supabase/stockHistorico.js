import { supabase } from './cliente'

const VISTA = 'vw_stock_historico_importado'

function aplicarFiltros(query, filtros = {}) {
  if (filtros.boticaId) query = query.eq('botica_id', filtros.boticaId)
  if (filtros.productoId) query = query.eq('producto_id', filtros.productoId)
  if (filtros.categoria) query = query.eq('categoria_terapeutica', filtros.categoria)
  if (filtros.stockout !== undefined && filtros.stockout !== '') query = query.eq('stockout_flag', filtros.stockout ? 1 : 0)
  if (filtros.fechaDesde) query = query.gte('fecha_snapshot', filtros.fechaDesde)
  if (filtros.fechaHasta) query = query.lte('fecha_snapshot', filtros.fechaHasta)
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

function calcularResumen(datos) {
  return {
    snapshots: datos.length,
    productos: new Set(datos.map(item => item.producto_id).filter(Boolean)).size,
    boticas: new Set(datos.map(item => item.botica_id).filter(Boolean)).size,
    semanasConStockout: datos.filter(item => Number(item.stockout_flag) === 1).length,
    demandaInsatisfechaTotal: datos.reduce((acc, item) => acc + Number(item.demanda_insatisfecha || 0), 0),
  }
}

export async function listarStockHistoricoImportado(filtros = {}) {
  const ordenCampo = filtros.ordenCampo || 'fecha_snapshot'
  const ascendente = filtros.ascendente === true
  let query = supabase.from(VISTA).select('*', { count: 'exact' })
  query = aplicarFiltros(query, filtros)
  query = aplicarPaginacion(query.order(ordenCampo, { ascending: ascendente }).order('producto', { ascending: true }), filtros)

  const { data, count, error } = await query
  if (error) throw new Error('Error al cargar stock historico importado: ' + error.message)
  const datos = data || []
  return { datos, total: count || 0, resumen: calcularResumen(datos) }
}
