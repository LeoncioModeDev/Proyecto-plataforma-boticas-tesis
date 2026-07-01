import { supabase } from './cliente'

const SELECCION = `
  id,
  org_id,
  botica_id,
  producto_id,
  periodo_inicio,
  periodo_fin,
  cantidad_predicha,
  prediccion_sarima,
  prediccion_xgboost,
  intervalo_inf,
  intervalo_sup,
  confianza,
  alpha,
  horizonte,
  metodo_aplicado,
  nivel_madurez,
  estrategia,
  generado_en,
  modelo_version_id
`

const MAPEAR_PREDICCION = (item) => ({
  id: item.id,
  orgId: item.org_id,
  boticaId: item.botica_id,
  productoId: item.producto_id,
  periodoInicio: item.periodo_inicio,
  periodoFin: item.periodo_fin,
  cantidadPredicha: item.cantidad_predicha,
  prediccionSarima: item.prediccion_sarima,
  prediccionXgboost: item.prediccion_xgboost,
  intervaloInf: item.intervalo_inf,
  intervaloSup: item.intervalo_sup,
  confianza: item.confianza,
  alpha: item.alpha,
  horizonte: item.horizonte,
  metodoAplicado: item.metodo_aplicado,
  nivelMadurez: item.nivel_madurez,
  estrategia: item.estrategia,
  generadoEn: item.generado_en,
  modeloVersionId: item.modelo_version_id,
})

export async function obtenerPredicciones(filtros = {}) {
  let query = supabase
    .from('predicciones_ml')
    .select(SELECCION)
    .order('generado_en', { ascending: false })

  if (filtros.orgId) query = query.eq('org_id', filtros.orgId)
  if (filtros.boticaId) query = query.eq('botica_id', filtros.boticaId)
  if (filtros.productoId) query = query.eq('producto_id', filtros.productoId)
  if (filtros.limit) query = query.limit(filtros.limit)

  const { data, error } = await query
  if (error) throw new Error('Error al cargar predicciones: ' + error.message)
  return (data || []).map(MAPEAR_PREDICCION)
}
