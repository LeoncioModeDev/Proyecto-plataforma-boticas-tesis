import { supabase } from './cliente'

const MAPEAR_LOTE = (item) => ({
  id: item.id,
  productoId: item.producto_id,
  ubicacionTipo: item.ubicacion_tipo,
  ubicacionId: item.ubicacion_id,
  numeroLote: item.numero_lote,
  fechaVencimiento: item.fecha_vencimiento,
  cantidad: item.cantidad,
  proveedorId: item.proveedor_id,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  codigoProducto: item.productos?.codigo_interno || null,
  nombreUbicacion: item.boticas?.nombre || item.ubicacion_id || 'Droguería Central',
})

const SELECCION = `
  id,
  producto_id,
  ubicacion_tipo,
  ubicacion_id,
  numero_lote,
  fecha_vencimiento,
  cantidad,
  proveedor_id,
  productos:producto_id (nombre_comercial, codigo_interno),
  boticas:ubicacion_id (nombre)
`

export async function obtenerLotesActivos(productoId, ubicacionTipo, ubicacionId, soloActivos = true) {
  let query = supabase
    .from('lotes')
    .select(SELECCION)

  if (soloActivos) {
    query = query.gt('cantidad', 0)
  }

  if (productoId) {
    query = query.eq('producto_id', productoId)
  }

  if (ubicacionTipo) {
    query = query.eq('ubicacion_tipo', ubicacionTipo)
  }

  if (ubicacionTipo === 'drogueria') {
    query = query.is('ubicacion_id', null)
  } else if (ubicacionId) {
    query = query.eq('ubicacion_id', ubicacionId)
  }

  const { data, error } = await query.order('fecha_vencimiento')

  if (error) throw new Error('Error al cargar lotes: ' + error.message)
  return (data || []).map(MAPEAR_LOTE)
}

export async function obtenerLotesDisponiblesParaTransferencia(productoId, ubicacionTipo, ubicacionId) {
  const lotes = await obtenerLotesActivos(productoId, ubicacionTipo, ubicacionTipo === 'drogueria' ? null : ubicacionId)

  if (!productoId) return []

  let stockQuery = supabase
    .from('stock_ubicaciones')
    .select('stock_fisico, stock_comprometido')
    .eq('producto_id', productoId)
    .eq('ubicacion_tipo', ubicacionTipo)

  if (ubicacionTipo === 'drogueria') {
    stockQuery = stockQuery.is('ubicacion_id', null)
  } else if (ubicacionId) {
    stockQuery = stockQuery.eq('ubicacion_id', ubicacionId)
  }

  const { data: stock, error } = await stockQuery.maybeSingle()
  if (error) throw new Error('Error al calcular stock disponible: ' + error.message)

  const stockDisponible = Math.max((stock?.stock_fisico ?? 0) - (stock?.stock_comprometido ?? 0), 0)
  let restanteDisponible = stockDisponible

  return lotes.map(lote => {
    const disponible = Math.max(Math.min(lote.cantidad, restanteDisponible), 0)
    restanteDisponible = Math.max(restanteDisponible - disponible, 0)
    return { ...lote, cantidadFisica: lote.cantidad, cantidad: disponible, stockDisponibleProducto: stockDisponible }
  }).filter(lote => lote.cantidad > 0)
}

export async function crearLote(datos) {
  const { data, error } = await supabase
    .from('lotes')
    .insert({
      producto_id: datos.productoId,
      ubicacion_tipo: datos.ubicacionTipo,
      ubicacion_id: datos.ubicacionId ?? null,
      numero_lote: datos.numeroLote,
      fecha_vencimiento: datos.fechaVencimiento,
      cantidad: datos.cantidad,
      proveedor_id: datos.proveedorId ?? null,
      org_id: datos.orgId,
    })
    .select(SELECCION)
    .single()

  if (error) throw new Error('Error al crear lote: ' + error.message)
  return MAPEAR_LOTE(data)
}

export async function obtenerLotesProximosAVencer(dias = 90) {
  const hoy = new Date().toISOString().split('T')[0]
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('lotes')
    .select(SELECCION)
    .gt('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', limite)
    .gt('cantidad', 0)
    .order('fecha_vencimiento')

  if (error) throw new Error('Error al cargar lotes por vencer: ' + error.message)
  return (data || []).map(MAPEAR_LOTE)
}
