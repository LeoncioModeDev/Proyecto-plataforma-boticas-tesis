export const ESTADOS_VENCIMIENTO = {
  vencido: { color: 'rojo', etiqueta: 'Vencido' },
  proximo: { color: 'amarillo', etiqueta: 'Próx. vencer' },
  vigente: { color: 'verde', etiqueta: 'Vigente' },
  sin_fecha: { color: 'gris', etiqueta: 'Sin fecha válida' },
  sin_umbral: { color: 'gris', etiqueta: 'No vencido' },
}

// Usar la fecha UTC, como las validaciones de recepción y transferencia en inventario.
export function fechaNegocioLotes(ahora = new Date()) {
  return ahora.toISOString().slice(0, 10)
}

function instanteCalendario(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NaN
  const instante = Date.parse(`${fecha}T00:00:00Z`)
  return Number.isFinite(instante) && fechaNegocioLotes(new Date(instante)) === fecha ? instante : NaN
}

export function clasificarVencimiento(fecha, alertaDias, hoy = fechaNegocioLotes()) {
  const dias = (instanteCalendario(fecha) - instanteCalendario(hoy)) / 86400000
  if (!Number.isFinite(dias)) return 'sin_fecha'
  if (dias < 0) return 'vencido'
  if (!Number.isInteger(alertaDias) || alertaDias < 0) return 'sin_umbral'
  return dias <= alertaDias ? 'proximo' : 'vigente'
}

export function mostrarFechaVencimiento(fecha) {
  return Number.isFinite(instanteCalendario(fecha)) ? fecha.split('-').reverse().join('/') : '—'
}
