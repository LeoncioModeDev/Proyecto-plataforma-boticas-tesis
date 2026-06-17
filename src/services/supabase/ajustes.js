import { supabase } from './cliente'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inventario-movimientos`

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('No hay sesión activa')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

const MAPEAR_MOVIMIENTO = (item) => ({
  id: item.id,
  tipo: item.tipo_movimiento,
  direccionAjuste: item.direccion_ajuste,
  productoId: item.producto_id,
  loteId: item.lote_id,
  ubicacionTipo: item.ubicacion_tipo,
  ubicacionId: item.ubicacion_id,
  cantidad: item.cantidad,
  motivo: item.motivo,
  usuarioId: item.usuario_id,
  createdAt: item.created_at,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  nombreUbicacion: item.boticas?.nombre || item.ubicacion_id || 'Droguería Central',
  nombreUsuario: item.usuario_id,
})

export async function obtenerAjustesYMermas(filtros = {}) {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()

  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.productoId) params.set('producto_id', filtros.productoId)
  if (filtros.ubicacionId) params.set('ubicacion_id', filtros.ubicacionId)
  if (filtros.orgId) params.set('org_id', filtros.orgId)

  const url = `${EDGE_FUNCTION_URL}?${params.toString()}`
  const res = await fetch(url, { headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Error al cargar ajustes y mermas')
  }

  const { datos } = await res.json()
  return (datos || []).map(MAPEAR_MOVIMIENTO)
}

export async function registrarAjuste(datos) {
  const headers = await getAuthHeaders()

  const body = {
    producto_id: datos.productoId,
    lote_id: datos.loteId,
    ubicacion_tipo: datos.ubicacionTipo,
    ubicacion_id: datos.ubicacionId,
    direccion_ajuste: datos.direccionAjuste,
    cantidad: datos.cantidad,
    motivo: datos.motivo,
  }

  const res = await fetch(`${EDGE_FUNCTION_URL}/ajuste`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar ajuste')
  }

  return MAPEAR_MOVIMIENTO(data.datos)
}

export async function registrarMerma(datos) {
  const headers = await getAuthHeaders()

  const body = {
    producto_id: datos.productoId,
    lote_id: datos.loteId,
    ubicacion_tipo: datos.ubicacionTipo,
    ubicacion_id: datos.ubicacionId,
    cantidad: datos.cantidad,
    motivo: datos.motivo,
  }

  const res = await fetch(`${EDGE_FUNCTION_URL}/merma`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar merma')
  }

  return MAPEAR_MOVIMIENTO(data.datos)
}
