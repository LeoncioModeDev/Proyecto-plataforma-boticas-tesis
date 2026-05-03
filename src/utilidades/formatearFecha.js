import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Funciones de formateo de fechas con locale español.
 */

/**
 * Formatea una fecha en formato corto: "28/04/2026"
 */
export function formatearFechaCorta(fecha) {
  const fechaObj = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(fechaObj, 'dd/MM/yyyy', { locale: es })
}

/**
 * Formatea una fecha en formato largo: "28 de abril de 2026"
 */
export function formatearFechaLarga(fecha) {
  const fechaObj = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(fechaObj, "d 'de' MMMM 'de' yyyy", { locale: es })
}

/**
 * Formatea una fecha en formato relativo: "hace 2 horas"
 */
export function formatearFechaRelativa(fecha) {
  const fechaObj = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return formatDistanceToNow(fechaObj, { addSuffix: true, locale: es })
}

/**
 * Calcula los días restantes hasta una fecha futura.
 * Retorna un número negativo si la fecha ya pasó.
 */
export function diasRestantes(fechaFutura) {
  const fechaObj = typeof fechaFutura === 'string' ? parseISO(fechaFutura) : fechaFutura
  return differenceInDays(fechaObj, new Date())
}

/**
 * Formatea fecha y hora: "28/04/2026 14:30"
 */
export function formatearFechaHora(fecha) {
  const fechaObj = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(fechaObj, 'dd/MM/yyyy HH:mm', { locale: es })
}
