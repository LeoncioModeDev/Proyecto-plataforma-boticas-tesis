import { supabase } from '@/services/supabase/cliente'

const BASE_URL = (import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

function construirUrl(path) {
  if (path === '/health') return `${BASE_URL}${path}`
  return `${BASE_URL}${path.startsWith('/api/v1') ? path : `/api/v1${path}`}`
}

function extraerMensajeError(data, estado) {
  if (typeof data?.detail === 'string') return data.detail
  if (data?.detail?.error?.mensaje) return data.detail.error.mensaje
  if (data?.error?.mensaje) return data.error.mensaje
  if (data?.message) return data.message
  if (data?.error) return data.error
  if (estado === 401) return 'Sesión expirada o no autenticada.'
  if (estado === 403) return 'No tienes permisos para esta operación.'
  if (estado === 404) return 'No se encontró la información solicitada.'
  if (estado === 422) return 'Los datos enviados no son válidos.'
  if (estado >= 500) return 'El servicio predictivo no pudo completar la operación.'
  return 'No se pudo completar la solicitud al servicio predictivo.'
}

export async function mlFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No existe una sesión activa.')
  }

  let response
  try {
    response = await fetch(construirUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers,
      },
    })
  } catch {
    throw new Error('API ML no disponible. Verifica que FastAPI esté ejecutándose en localhost:8000.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extraerMensajeError(data, response.status))
  }

  return data
}

export const clienteML = {
  baseURL: BASE_URL,
  fetch: mlFetch,
}
