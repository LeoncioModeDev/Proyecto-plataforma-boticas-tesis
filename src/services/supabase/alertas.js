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

const MAPEAR_ALERTA = (item, nombresReferencia = {}) => ({
  id: item.id,
  tipo: item.tipo,
  tipoOrigen: item.tipo_origen === 'ml' ? 'modelo' : item.tipo_origen,
  productoId: item.producto_id,
  boticaId: item.botica_id,
  urgencia: item.urgencia,
  resuelta: item.resuelta,
  mensaje: item.mensaje,
  condicionHash: item.condicion_hash,
  referenciaTipo: item.referencia_tipo,
  referenciaId: item.referencia_id,
  referenciaNombre: nombresReferencia[item.referencia_id] || null,
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

  const idsLote = [...new Set((data || [])
    .filter(item => item.referencia_tipo === 'lotes' && item.referencia_id)
    .map(item => item.referencia_id))]

  let nombresLote = {}
  if (idsLote.length > 0) {
    const { data: lotes, error: errorLotes } = await supabase
      .from('lotes')
      .select('id, numero_lote')
      .in('id', idsLote)

    if (!errorLotes) {
      nombresLote = Object.fromEntries((lotes || []).map(lote => [lote.id, lote.numero_lote]))
    }
  }

  return (data || []).map(item => MAPEAR_ALERTA(item, nombresLote))
}
