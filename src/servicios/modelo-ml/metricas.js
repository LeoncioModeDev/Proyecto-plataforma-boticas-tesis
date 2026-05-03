/**
 * Obtiene métricas de rendimiento del modelo activo (mock).
 */
export async function obtenerMetricasModelo() {
  await new Promise(r => setTimeout(r, 300))
  return {
    mape: 8.6,
    rmse: 10.2,
    modeloActivo: 'SARIMA + XGBoost (Híbrido)',
    ultimoEntrenamiento: '2026-05-01T03:00:00',
    productosEntrenados: 10,
  }
}
