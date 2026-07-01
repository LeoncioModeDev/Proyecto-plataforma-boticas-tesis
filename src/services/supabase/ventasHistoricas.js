import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ventas-historicas`
  : null

async function llamarEdgeFunction(params = {}) {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL no configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') qs.set(key, String(val))
  })
  const queryString = qs.toString()

  const res = await fetch(`${EDGE_FN_URL}${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export async function listarVentasHistoricasImportadas(filtros = {}) {
  const { datos, total, resumen } = await llamarEdgeFunction({
    pagina: filtros.pagina,
    limite: filtros.limite,
    busqueda: filtros.busqueda,
    boticaId: filtros.boticaId,
    productoId: filtros.productoId,
    categoria: filtros.categoria,
    importacionId: filtros.importacionId,
    fechaDesde: filtros.fechaDesde,
    fechaHasta: filtros.fechaHasta,
    ordenCampo: filtros.ordenCampo,
    ascendente: filtros.ascendente,
  })
  return { datos, total, resumen }
}
