import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/productos`
  : null

async function llamarEdgeFunction(method, path, body) {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL no configurado')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')
  const res = await fetch(`${EDGE_FN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
  return json
}

const MAPEAR_STOCK = (item) => ({
  id: item.id,
  productoId: item.producto_id,
  ubicacionTipo: item.ubicacion_tipo,
  ubicacionId: item.ubicacion_id,
  stockFisico: item.stock_fisico ?? 0,
  stockMinimo: item.stock_minimo,
  stockMaximo: item.stock_maximo ?? null,
  stockComprometido: item.stock_comprometido ?? 0,
  stockReservado: item.stock_comprometido ?? 0,
  stockDisponible: Math.max((item.stock_fisico ?? 0) - (item.stock_comprometido ?? 0), 0),
  stockPorRecibir: item.stock_por_recibir ?? 0,
  stockEnTransito: item.stock_en_transito ?? 0,
  updatedAt: item.modified_at,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  codigoProducto: item.productos?.codigo_interno || null,
  nombreUbicacion: item.boticas?.nombre || item.ubicacion_id || 'Droguería Central',
  cantidadDisponible: Math.max((item.stock_fisico ?? 0) - (item.stock_comprometido ?? 0), 0),
  ultimaActualizacion: item.modified_at,
})

const SELECCION = `
  id,
  producto_id,
  ubicacion_tipo,
  ubicacion_id,
  stock_fisico,
  stock_minimo,
  stock_maximo,
  stock_comprometido,
  stock_por_recibir,
  stock_en_transito,
  modified_at,
  productos:producto_id (nombre_comercial, codigo_interno),
  boticas:ubicacion_id (nombre)
`

export async function obtenerStockPorUbicacion(ubicacionId) {
  let query = supabase
    .from('stock_ubicaciones')
    .select(SELECCION)

  if (ubicacionId) {
    query = query.eq('ubicacion_id', ubicacionId)
  }

  const { data, error } = await query.order('producto_id')

  if (error) throw new Error('Error al cargar stock: ' + error.message)
  return (data || []).map(MAPEAR_STOCK)
}

export async function obtenerStockProducto(productoId) {
  const { data, error } = await supabase
    .from('stock_ubicaciones')
    .select(SELECCION)
    .eq('producto_id', productoId)

  if (error) throw new Error('Error al cargar stock del producto: ' + error.message)
  return (data || []).map(MAPEAR_STOCK)
}

export async function obtenerStockPorId(id) {
  const { data, error } = await supabase
    .from('stock_ubicaciones')
    .select(SELECCION)
    .eq('id', id)
    .single()

  if (error) throw new Error('Error al cargar detalle de stock: ' + error.message)
  return MAPEAR_STOCK(data)
}

export async function actualizarStockConfig(productoId, { ubicacionTipo, ubicacionId, stockMinimo, stockMaximo }) {
  return llamarEdgeFunction('PATCH', `/${productoId}/stock-config`, {
    ubicacion_tipo: ubicacionTipo,
    ubicacion_id: ubicacionId || null,
    stock_minimo: stockMinimo,
    stock_maximo: stockMaximo,
  })
}
