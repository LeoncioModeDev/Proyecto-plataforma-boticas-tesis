/**
 * Clasifica el estado de alerta de un registro de stock según sus niveles.
 * Retorna: "normal", "bajo", "sin_stock", "sobrestock"
 */
export function clasificarAlerta(registro) {
  const { stockDisponible, stockMinimo } = registro

  if (stockDisponible === 0) {
    return 'sin_stock'
  }

  if (stockDisponible < stockMinimo) {
    return 'bajo'
  }

  // Sobrestock si excede 3 veces el mínimo
  if (stockMinimo > 0 && stockDisponible > stockMinimo * 3) {
    return 'sobrestock'
  }

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
