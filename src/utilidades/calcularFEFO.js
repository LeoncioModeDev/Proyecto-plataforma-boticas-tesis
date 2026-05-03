import { parseISO } from 'date-fns'

/**
 * Ordena lotes por fecha de vencimiento ascendente (FEFO: First Expired, First Out).
 * Los lotes que vencen primero van al inicio del array.
 */
export function calcularFEFO(lotes) {
  return [...lotes].sort((a, b) => {
    const fechaA = typeof a.fechaVencimiento === 'string' ? parseISO(a.fechaVencimiento) : a.fechaVencimiento
    const fechaB = typeof b.fechaVencimiento === 'string' ? parseISO(b.fechaVencimiento) : b.fechaVencimiento
    return fechaA - fechaB
  })
}

/**
 * Selecciona el lote más próximo a vencer que tenga suficiente stock.
 * Si ningún lote individual cubre la cantidad, retorna el primero disponible.
 */
export function seleccionarLoteFEFO(lotes, cantidadRequerida) {
  const lotesOrdenados = calcularFEFO(lotes).filter(lote => lote.cantidad > 0)

  // Buscar el primer lote que cubra toda la cantidad
  const loteCompleto = lotesOrdenados.find(lote => lote.cantidad >= cantidadRequerida)

  // Si ninguno cubre todo, retornar el primero con stock
  return loteCompleto || lotesOrdenados[0] || null
}
