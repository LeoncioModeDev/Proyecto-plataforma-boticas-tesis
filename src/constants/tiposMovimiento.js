/**
 * Tipos de movimiento de inventario y sus configuraciones.
 */
export const TIPOS_MOVIMIENTO = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
  AJUSTE: 'ajuste',
  MERMA: 'merma',
}

export const ETIQUETAS_MOVIMIENTO = {
  [TIPOS_MOVIMIENTO.ENTRADA]: 'Entrada',
  [TIPOS_MOVIMIENTO.SALIDA]: 'Salida',
  [TIPOS_MOVIMIENTO.AJUSTE]: 'Ajuste',
  [TIPOS_MOVIMIENTO.MERMA]: 'Merma',
}

export const COLORES_MOVIMIENTO = {
  [TIPOS_MOVIMIENTO.ENTRADA]: 'verde',
  [TIPOS_MOVIMIENTO.SALIDA]: 'azul',
  [TIPOS_MOVIMIENTO.AJUSTE]: 'amarillo',
  [TIPOS_MOVIMIENTO.MERMA]: 'rojo',
}

export const OPCIONES_MOVIMIENTO = Object.entries(ETIQUETAS_MOVIMIENTO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))
