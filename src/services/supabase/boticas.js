import { supabase } from './cliente'

const URL_BOTICAS = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/boticas`

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

  const res = await fetch(`${URL_BOTICAS}${path}`, opciones)
  const data = await res.json()

  if (!res.ok) throw new Error(data.error || 'Error en la solicitud')
  return data
}

const MAPEAR_BOTICA = (item) => ({
  id: item.id,
  orgId: item.org_id,
  nombre: item.nombre,
  tipo: item.tipo,
  ubigeo: item.ubigeo,
  direccion: item.direccion,
  telefono: item.telefono,
  activa: item.activa,
  codigoInterno: item.codigo_interno,
  encargadoUsuarioId: item.encargado_usuario_id,
  encargadoNombre: item.encargado?.nombre || null,
  encargadoEmail: item.encargado?.email || null,
  encargadoEsFallback: item.encargado_es_fallback || false,
  encargadoVisibleId: item.encargado_visible?.id || null,
  encargadoVisibleNombre: item.encargado_visible?.nombre || null,
  encargadoVisibleEmail: item.encargado_visible?.email || null,
  createdAt: item.created_at,
})

export async function listarBoticas(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.activas) params.set('activas', 'true')
  if (filtros.tipo) params.set('tipo', filtros.tipo)

  const qs = params.toString()
  const { datos } = await peticion('GET', qs ? `?${qs}` : '')
  return (datos || []).map(MAPEAR_BOTICA)
}

export async function obtenerBotica(id) {
  const { datos } = await peticion('GET', `/${id}`)
  return MAPEAR_BOTICA(datos)
}

export async function crearBotica(datos) {
  const { exito, id, codigo_interno } = await peticion('POST', '', datos)
  return { exito, id, codigoInterno: codigo_interno }
}

export async function actualizarBotica(id, datos) {
  const { exito } = await peticion('PATCH', `/${id}`, datos)
  return { exito }
}

export async function toggleBotica(id) {
  const { exito, activa } = await peticion('PATCH', `/${id}/toggle`)
  return { exito, activa }
}

export async function obtenerBoticasActivas(orgId) {
  if (!orgId) return []
  const boticas = await listarBoticas({ activas: true })
  return boticas.map(b => ({ ...b, orgId: b.orgId || orgId }))
}
