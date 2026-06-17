import { supabase } from './cliente'

const SELECCION = `
  id,
  tipo,
  tipo_origen,
  producto_id,
  botica_id,
  urgencia,
  resuelta,
  generado_en,
  productos:producto_id (nombre_comercial),
  boticas:botica_id (nombre)
`

const MAPEAR_ALERTA = (item) => ({
  id: item.id,
  tipo: item.tipo,
  tipoOrigen: item.tipo_origen,
  productoId: item.producto_id,
  boticaId: item.botica_id,
  urgencia: item.urgencia,
  resuelta: item.resuelta,
  generadoEn: item.generado_en,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  nombreBotica: item.boticas?.nombre || item.botica_id,
})

export async function obtenerAlertas({ soloNoResueltas, max } = {}) {
  let query = supabase
    .from('alertas_ml')
    .select(SELECCION)
    .order('generado_en', { ascending: false })

  if (soloNoResueltas) {
    query = query.eq('resuelta', false)
  }

  if (max) {
    query = query.limit(max)
  }

  const { data, error } = await query

  if (error) throw new Error('Error al cargar alertas: ' + error.message)
  return (data || []).map(MAPEAR_ALERTA)
}
