import { supabase } from './cliente'

const URL_USUARIOS = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/usuarios`

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

  const res = await fetch(`${URL_USUARIOS}${path}`, opciones)
  const data = await res.json()

  if (!res.ok) throw new Error(data.error || 'Error en la solicitud')
  return data
}

const MAPEAR_USUARIO = (item) => ({
  id: item.id,
  orgId: item.org_id,
  nombre: item.nombre,
  email: item.email,
  rol: item.rol,
  boticaId: item.botica_id,
  boticaNombre: item.botica?.nombre || null,
  drogueriaId: item.drogueria_id,
  drogueriaNombre: item.drogueria?.nombre || null,
  avatar: item.avatar,
  telefono: item.telefono,
  activo: item.activo,
  ultimoAcceso: item.ultimo_acceso,
  createdAt: item.created_at,
})

export async function listarUsuarios(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.activos) params.set('activos', 'true')
  if (filtros.rol) params.set('rol', filtros.rol)

  const qs = params.toString()
  const { datos } = await peticion('GET', qs ? `?${qs}` : '')
  return (datos || []).map(MAPEAR_USUARIO)
}

export async function obtenerUsuario(id) {
  const { datos } = await peticion('GET', `/${id}`)
  return MAPEAR_USUARIO(datos)
}

export async function crearUsuario(datos) {
  const { exito, id } = await peticion('POST', '', {
    nombre: datos.nombre,
    email: datos.email,
    password: datos.password,
    rol: datos.rol,
    botica_id: datos.boticaId || null,
    telefono: datos.telefono || null,
  })
  return { exito, id }
}

export async function actualizarUsuario(id, datos) {
  const payload = {}
  if (datos.nombre !== undefined) payload.nombre = datos.nombre
  if (datos.rol !== undefined) payload.rol = datos.rol
  if (datos.boticaId !== undefined) payload.botica_id = datos.boticaId
  if (datos.telefono !== undefined) payload.telefono = datos.telefono

  const { exito } = await peticion('PATCH', `/${id}`, payload)
  return { exito }
}

export async function toggleUsuario(id) {
  const { exito, activo } = await peticion('PATCH', `/${id}/toggle`)
  return { exito, activo }
}
