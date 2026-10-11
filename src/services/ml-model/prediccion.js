import { generarPrediccion } from './prediccionesML'

/**
 * Solicita una predicción al modelo ML real.
 */
export async function solicitarPrediccion(productoId, boticaId, periodo = 3) {
  const respuesta = await generarPrediccion({
    producto_id: productoId,
    botica_id: boticaId,
    horizonte_semanas: periodo,
  })
  return { prediccion: respuesta.predicciones, metricas: { estrategia: respuesta.estrategia_utilizada } }
}
