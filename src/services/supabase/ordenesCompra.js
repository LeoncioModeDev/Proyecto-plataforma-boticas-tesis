import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ordenes-compra`
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

export async function listarOrdenes(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.proveedorId) params.set('proveedor_id', filtros.proveedorId)
  if (filtros.search) params.set('search', filtros.search)
  const qs = params.toString()
  const { datos } = await llamarEdgeFunction('GET', qs ? `?${qs}` : '')
  return datos || []
}

export async function obtenerOrden(id) {
  const { datos } = await llamarEdgeFunction('GET', `/${id}`)
  return datos
}

export async function crearOrden({ proveedorId, fechaEstimadaEntrega, observaciones, items }) {
  return llamarEdgeFunction('POST', '', {
    proveedor_id: proveedorId,
    fecha_estimada_entrega: fechaEstimadaEntrega,
    observaciones,
    items: items.map(i => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
    })),
  })
}

export async function actualizarOrden(id, { fechaEstimadaEntrega, observaciones, items }) {
  return llamarEdgeFunction('PUT', `/${id}`, {
    fecha_estimada_entrega: fechaEstimadaEntrega,
    observaciones,
    items: items?.map(i => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
    })),
  })
}

export async function aprobarOrden(id) {
  return llamarEdgeFunction('PUT', `/${id}/aprobar`)
}

export async function marcarPorRecibir(id) {
  return llamarEdgeFunction('PUT', `/${id}/por-recibir`)
}

export async function rechazarOrden(id, motivo) {
  return llamarEdgeFunction('PUT', `/${id}/rechazar`, { motivo })
}

export async function cancelarOrden(id, motivo) {
  return llamarEdgeFunction('PUT', `/${id}/cancelar`, { motivo })
}

export async function registrarRecepcion(ordenId, { items = [], observacion, resultado, motivoRechazo }) {
  return llamarEdgeFunction('POST', `/${ordenId}/recepciones`, {
    resultado,
    motivo_rechazo: motivoRechazo || undefined,
    observacion,
    items: resultado === 'en_devolucion' ? undefined : items.map(i => ({
      producto_id: i.productoId,
      numero_lote: i.numeroLote,
      fecha_vencimiento: i.fechaVencimiento,
      cantidad_recibida: i.cantidadRecibida,
    })),
  })
}

export async function listarRecepciones(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.proveedorId) params.set('proveedor_id', filtros.proveedorId)
  if (filtros.ordenCompraId) params.set('orden_compra_id', filtros.ordenCompraId)
  if (filtros.resultado) params.set('resultado', filtros.resultado)
  if (filtros.registradoPor) params.set('registrado_por', filtros.registradoPor)
  if (filtros.fechaDesde) params.set('fecha_desde', filtros.fechaDesde)
  if (filtros.fechaHasta) params.set('fecha_hasta', filtros.fechaHasta)
  const qs = params.toString()
  const { datos } = await llamarEdgeFunction('GET', `/recepciones${qs ? `?${qs}` : ''}`)
  return datos || []
}

export async function obtenerPendientes(ordenId) {
  const { datos } = await llamarEdgeFunction('GET', `/${ordenId}/pendientes`)
  return datos || []
}

export const ESTADOS_OC = {
  pendiente:              { etiqueta: 'Pendiente', color: 'amarillo' },
  aprobada:               { etiqueta: 'Aprobada', color: 'azul' },
  por_recibir:            { etiqueta: 'Por Recibir', color: 'indigo' },
  rechazada:              { etiqueta: 'Rechazada', color: 'rojo' },
  cancelada:              { etiqueta: 'Cancelada', color: 'gris' },
  recibida:               { etiqueta: 'Recibida', color: 'verde' },
  recibida_parcial:       { etiqueta: 'Recibida Parcial', color: 'naranja' },
  recibida_con_observacion: { etiqueta: 'Recibida (Obs.)', color: 'celeste' },
  en_devolucion:          { etiqueta: 'En Devolución', color: 'rojo' },
}
