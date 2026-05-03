/**
 * Calcula el MAPE (Mean Absolute Percentage Error) entre valores reales y predichos.
 * Retorna el error como porcentaje.
 * Ignora pares donde el valor real es 0 para evitar división entre cero.
 */
export function calcularMAPE(reales, predichos) {
  if (!reales || !predichos || reales.length !== predichos.length || reales.length === 0) {
    return 0
  }

  let suma = 0
  let conteo = 0

  for (let i = 0; i < reales.length; i++) {
    if (reales[i] !== 0) {
      suma += Math.abs((reales[i] - predichos[i]) / reales[i])
      conteo++
    }
  }

  if (conteo === 0) return 0

  return (suma / conteo) * 100
}

/**
 * Calcula el RMSE (Root Mean Squared Error) entre valores reales y predichos.
 */
export function calcularRMSE(reales, predichos) {
  if (!reales || !predichos || reales.length !== predichos.length || reales.length === 0) {
    return 0
  }

  const sumaCuadrados = reales.reduce((acc, real, i) => {
    return acc + Math.pow(real - predichos[i], 2)
  }, 0)

  return Math.sqrt(sumaCuadrados / reales.length)
}
