const FECHA = /^([0-9]{4}-[0-9]{2}-[0-9]{2})$/
const FECHA_HORA_LOCAL = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T(?:[01][0-9]|2[0-3]):[0-5][0-9]$/

/**
 * @param {string | null | undefined} desde
 * @param {string | null | undefined} hasta
 * @param {'date' | 'datetime-local'} tipo
 * @returns {string | null}
 */
export function validarRangoFechas(desde, hasta, tipo = 'date') {
  const patron = tipo === 'datetime-local' ? FECHA_HORA_LOCAL : FECHA
  const campo = tipo === 'datetime-local' ? 'fecha/hora' : 'fecha'

  /** @param {string} valor */
  function esValido(valor) {
    const dia = patron.exec(valor)?.[1]
    if (!dia || dia.startsWith('0000-') || valor.trim() !== valor) return false
    const fecha = new Date(`${dia}T00:00:00Z`)
    return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === dia
  }

  if (desde && !esValido(desde)) return `Ingresa una ${campo} inicial válida.`
  if (hasta && !esValido(hasta)) return `Ingresa una ${campo} final válida.`
  if (desde && hasta && desde > hasta) return `La ${campo} inicial no puede ser posterior a la final.`
  return null
}
