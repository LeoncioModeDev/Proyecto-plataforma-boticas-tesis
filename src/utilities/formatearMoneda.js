/**
 * Formatea un número como moneda peruana (Soles).
 * Ejemplo: formatearSoles(1234.56) → "S/ 1,234.56"
 */
export function formatearSoles(numero) {
  if (numero == null || isNaN(numero)) return 'S/ 0.00'

  return `S/ ${Number(numero).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Formatea un número con separadores de miles.
 * Ejemplo: formatearNumero(1234) → "1,234"
 */
export function formatearNumero(numero) {
  if (numero == null || isNaN(numero)) return '0'
  return Number(numero).toLocaleString('es-PE')
}
