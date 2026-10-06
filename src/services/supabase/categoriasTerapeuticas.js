import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorias-terapeuticas`
  : null

async function llamarEdgeFunction(method, path = '', body) {
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
  if (!res.ok) {
    const error = new Error(json.error || `Error ${res.status}`)
    error.detalle = json
    throw error
  }
  return json
}

function mapearCategoria(c) {
  const productosAsociados = Array.isArray(c.productos) && c.productos[0]?.count != null
    ? Number(c.productos[0].count)
    : Number(c.productos_count || 0)
  return {
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    descripcion: c.descripcion,
    activo: c.activo,
    productosAsociados,
    createdAt: c.created_at,
    modifiedAt: c.modified_at,
  }
}

export async function listarCategoriasTerapeuticas(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.q) params.set('q', filtros.q)
  if (filtros.activo !== undefined && filtros.activo !== '') params.set('activo', String(filtros.activo))
  const qs = params.toString()
  const { datos } = await llamarEdgeFunction('GET', qs ? `?${qs}` : '')
  return Array.isArray(datos) ? datos.map(mapearCategoria) : []
}

export async function obtenerCategoriaTerapeutica(id) {
  const { datos } = await llamarEdgeFunction('GET', `/${id}`)
  return datos ? mapearCategoria(datos) : null
}

export async function crearCategoriaTerapeutica(datos) {
  return llamarEdgeFunction('POST', '', {
    codigo: datos.codigo,
    nombre: datos.nombre,
    descripcion: datos.descripcion || null,
    activo: datos.activo !== false,
  })
}

export async function actualizarCategoriaTerapeutica(id, datos) {
  return llamarEdgeFunction('PATCH', `/${id}`, {
    codigo: datos.codigo,
    nombre: datos.nombre,
    descripcion: datos.descripcion || null,
  })
}

export async function cambiarEstadoCategoriaTerapeutica(id, opciones = {}) {
  return llamarEdgeFunction('PATCH', `/${id}/toggle`, { confirmar: opciones.confirmar === true })
}
