/**
 * Clasifica el estado de alerta de un registro de stock según sus niveles.
 * Retorna: "normal", "bajo", "sin_stock", "sobrestock"
 */
export function clasificarAlerta(registro) {
  const disponible = registro.cantidadDisponible ?? registro.stockDisponible ?? 0
  const minimo = registro.stockMinimo ?? 0

  if (disponible === 0) return 'sin_stock'
  if (disponible < minimo) return 'bajo'
  if (minimo > 0 && disponible > minimo * 3) return 'sobrestock'
  return 'normal'
}

/**
 * Mapeo de estado de alerta a color de insignia.
 */
export const COLORES_ESTADO_STOCK = {
  normal: 'verde',
  bajo: 'amarillo',
  sin_stock: 'rojo',
  sobrestock: 'azul',
}

/**
 * Mapeo de estado de alerta a etiqueta legible.
 */
export const ETIQUETAS_ESTADO_STOCK = {
  normal: 'Normal',
  bajo: 'Bajo Stock',
  sin_stock: 'Sin Stock',
  sobrestock: 'Sobrestock',
}
