export function clasificarAlerta(registro) {
  const disponible = registro.stockDisponible ?? registro.cantidadDisponible ?? 0
  const minimo = registro.stockMinimo ?? 0
  const maximo = registro.stockMaximo ?? null

  if (disponible === 0) return 'sin_stock'
  if (minimo > 0 && disponible <= minimo * 0.5) return 'critico'
  if (minimo > 0 && disponible <= minimo) return 'bajo'
  if (maximo > 0 && disponible > maximo) return 'sobrestock'
  return 'normal'
}

export const COLORES_ESTADO_STOCK = {
  normal: 'verde',
  bajo: 'amarillo',
  critico: 'naranja',
  sin_stock: 'rojo',
  sobrestock: 'azul',
}

export const ETIQUETAS_ESTADO_STOCK = {
  normal: 'Normal',
  bajo: 'Stock Bajo',
  critico: 'Stock Crítico',
  sin_stock: 'Sin Stock',
  sobrestock: 'Sobrestock',
}
