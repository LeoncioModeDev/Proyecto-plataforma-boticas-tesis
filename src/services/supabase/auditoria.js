import { supabase } from './cliente'

const URL_AUDITORIA = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auditoria`

async function obtenerToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('No hay sesión activa')
  return data.session.access_token
}

async function peticion(method, path) {
  const token = await obtenerToken()
  const res = await fetch(`${URL_AUDITORIA}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud')
  return data
}

const MAPEAR_REGISTRO = (item) => ({
  id: item.id,
  orgId: item.org_id,
  usuarioId: item.usuario_id,
  usuario: item.usuario?.nombre || 'Sistema',
  accion: item.accion,
  entidad: item.entidad,
  entidadId: item.entidad_id,
  nivel: item.nivel,
  detalle: item.detalle,
  metadata: item.metadata_jsonb,
  createdAt: item.created_at,
})

export async function listarAuditoria(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.accion) params.set('accion', filtros.accion)
  if (filtros.entidad) params.set('entidad', filtros.entidad)
  if (filtros.nivel) params.set('nivel', filtros.nivel)
  if (filtros.busqueda) params.set('busqueda', filtros.busqueda)
  if (filtros.pagina) params.set('pagina', filtros.pagina)
  if (filtros.limite) params.set('limite', filtros.limite)

  const qs = params.toString()
  const { datos, total, pagina, limite, totalPaginas } = await peticion('GET', qs ? `?${qs}` : '')
  return {
    datos: (datos || []).map(MAPEAR_REGISTRO),
    total,
    pagina,
    limite,
    totalPaginas,
  }
}
