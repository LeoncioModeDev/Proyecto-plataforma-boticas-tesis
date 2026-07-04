import { supabase } from './cliente'

const SELECCION = `
  id,
  tipo,
  tipo_origen,
  producto_id,
  botica_id,
  urgencia,
  resuelta,
  mensaje,
  condicion_hash,
  referencia_tipo,
  referencia_id,
  stock_actual,
  stock_proyectado,
  cantidad_recomendada,
  fecha_vencimiento,
  metadata_jsonb,
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
  mensaje: item.mensaje,
  condicionHash: item.condicion_hash,
  referenciaTipo: item.referencia_tipo,
  referenciaId: item.referencia_id,
  stockActual: item.stock_actual,
  stockProyectado: item.stock_proyectado,
  cantidadRecomendada: item.cantidad_recomendada,
  fechaVencimiento: item.fecha_vencimiento,
  metadata: item.metadata_jsonb || {},
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
