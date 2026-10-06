import { supabase } from './cliente'

const VISTA = 'vw_precios_importados'

function aplicarFiltros(query, filtros = {}) {
  if (filtros.boticaId) query = query.eq('botica_id', filtros.boticaId)
  if (filtros.productoId) query = query.eq('producto_id', filtros.productoId)
  if (filtros.categoria) query = query.eq('categoria_terapeutica', filtros.categoria)
  if (filtros.estadoVigencia) query = query.eq('estado_vigencia', filtros.estadoVigencia)
  if (filtros.fechaDesde) query = query.gte('vigente_desde', filtros.fechaDesde)
  if (filtros.fechaHasta) query = query.lte('vigente_desde', filtros.fechaHasta)
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

export async function listarPreciosImportados(filtros = {}) {
  const ordenCampo = filtros.ordenCampo || 'producto'
  const ascendente = filtros.ascendente !== false
  let query = supabase.from(VISTA).select('*', { count: 'exact' })
  query = aplicarFiltros(query, filtros)
  query = aplicarPaginacion(query.order(ordenCampo, { ascending: ascendente }).order('botica', { ascending: true }), filtros)

  const { data, count, error } = await query
  if (error) throw new Error('Error al cargar precios importados: ' + error.message)
  return { datos: data || [], total: count || 0 }
}
