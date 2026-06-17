import { supabase } from './cliente'

const URL_TRANSFERENCIAS = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transferencias`

async function obtenerToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('No hay sesión activa')
  return data.session.access_token
}

async function peticion(method, path, body = null) {
  const token = await obtenerToken()
  const opciones = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (body) opciones.body = JSON.stringify(body)

  const res = await fetch(`${URL_TRANSFERENCIAS}${path}`, opciones)
  const data = await res.json()

  if (!res.ok) {
    const mensaje = data.error || 'Error en la solicitud'
    const detalle = data.detalle ? `\nDetalle: ${JSON.stringify(data.detalle)}` : ''
    const hint = data.hint ? `\nSugerencia: ${data.hint}` : ''
    console.error(`[Transferencias] ${method} ${path} falló:`, { status: res.status, data })
    throw new Error(`${mensaje}${detalle}${hint}`)
  }
  return data
}

const MAPEAR_TRANSFERENCIA = (item) => ({
  id: item.id,
  tipoTransferencia: item.tipo_transferencia,
  origenTipo: item.origen_tipo,
  origenId: item.origen_id,
  destinoTipo: item.destino_tipo,
  destinoId: item.destino_id,
  estado: item.estado,
  creadoPor: item.creado_por,
  fechaDespacho: item.fecha_despacho,
  fechaRecepcion: item.fecha_recepcion,
  observaciones: item.observaciones,
  motivoRechazo: item.motivo_rechazo,
  orgId: item.org_id,
  createdAt: item.created_at,
  origen: item.origen ? { id: item.origen.id, nombre: item.origen.nombre } : null,
  destino: item.destino ? { id: item.destino.id, nombre: item.destino.nombre } : null,
  items: (item.transferencias_items || []).map(MAPEAR_ITEM),
})

const MAPEAR_ITEM = (item) => ({
  id: item.id,
  transferenciaId: item.transferencia_id,
  productoId: item.producto_id,
  loteId: item.lote_id,
  cantidad: item.cantidad,
  producto: item.producto ? { id: item.producto.id, nombreComercial: item.producto.nombre_comercial } : null,
  lote: item.lote ? { id: item.lote.id, numeroLote: item.lote.numero_lote, fechaVencimiento: item.lote.fecha_vencimiento } : null,
})

export async function obtenerTransferencias(estado = null) {
  const params = estado ? `?estado=${encodeURIComponent(estado)}` : ''
  const { datos } = await peticion('GET', params)
  return (datos || []).map(MAPEAR_TRANSFERENCIA)
}

export async function obtenerTransferencia(id) {
  const { datos } = await peticion('GET', `/${id}`)
  return MAPEAR_TRANSFERENCIA(datos)
}

export async function crearTransferencia(datos) {
  const { exito, id } = await peticion('POST', '', datos)
  return { exito, id }
}

export async function enviarTransferencia(id) {
  const { exito, estado } = await peticion('PUT', `/${id}/enviar`)
  return { exito, estado }
}

export async function cancelarTransferencia(id, motivo) {
  const { exito, estado } = await peticion('PUT', `/${id}/cancelar`, { motivo })
  return { exito, estado }
}

export async function recibirTransferencia(id) {
  const { exito, estado } = await peticion('PUT', `/${id}/recibir`)
  return { exito, estado }
}

export async function rechazarTransferencia(id, motivoRechazo) {
  const { exito, estado } = await peticion('PUT', `/${id}/rechazar`, { motivo_rechazo: motivoRechazo })
  return { exito, estado }
}
