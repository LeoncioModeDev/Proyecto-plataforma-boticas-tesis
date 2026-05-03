import { predicciones as prediccionesMock } from '@/datos-prueba/predicciones'

const LATENCIA = 300

export async function obtenerPredicciones(filtros = {}) {
  await new Promise(r => setTimeout(r, LATENCIA))
  let resultado = [...prediccionesMock]
  if (filtros.productoId) resultado = resultado.filter(p => p.productoId === filtros.productoId)
  if (filtros.boticaId) resultado = resultado.filter(p => p.boticaId === filtros.boticaId)
  return resultado
}

export async function obtenerSerieHistorica(productoId, boticaId) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const pred = prediccionesMock.find(p => p.productoId === productoId && p.boticaId === boticaId)
  return pred ? pred.serieHistorica : []
}
