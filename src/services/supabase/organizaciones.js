import { supabase } from './cliente'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/organizaciones`
  : null

async function obtenerToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('No hay sesión activa')
  return data.session.access_token
}

/**
 * Lista todas las organizaciones con datos relacionados (droguería, admin, dominio).
 */
export async function listarOrganizaciones() {
  if (!URL_BASE) throw new Error('VITE_SUPABASE_URL no está configurado')

  const token = await obtenerToken()
  const res = await fetch(URL_BASE, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al listar organizaciones')
  return data.datos
}

/**
 * Obtiene una organización por su ID con todos los detalles.
 */
export async function obtenerOrganizacion(id) {
  if (!URL_BASE) throw new Error('VITE_SUPABASE_URL no está configurado')

  const token = await obtenerToken()
  const res = await fetch(`${URL_BASE}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al obtener organización')
  return data.datos
}

/**
 * Actualiza campos editables de una organización.
 * @param {string} id - UUID de la organización
 * @param {object} campos - { nombre?, pais_origen?, drogueria_nombre?, drogueria_direccion?, drogueria_telefono? }
 */
export async function actualizarOrganizacion(id, campos) {
  if (!URL_BASE) throw new Error('VITE_SUPABASE_URL no está configurado')

  const token = await obtenerToken()
  const res = await fetch(`${URL_BASE}/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(campos),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al actualizar organización')
  return data
}
