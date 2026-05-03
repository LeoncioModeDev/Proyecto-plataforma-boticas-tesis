import { predicciones } from '@/mock-data/predicciones'

/**
 * Solicita una predicción al modelo ML (mock).
 */
export async function solicitarPrediccion(productoId, boticaId, periodo = 3) {
  await new Promise(r => setTimeout(r, 500))
  const pred = predicciones.find(p => p.productoId === productoId && p.boticaId === boticaId)
  if (pred) return { prediccion: pred.pronostico.slice(0, periodo), metricas: pred.metricas }
  return { prediccion: [], metricas: { mape: 0, rmse: 0 } }
}
