/**
 * Tipos de movimiento de inventario y sus configuraciones.
 */
export const TIPOS_MOVIMIENTO = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
  AJUSTE: 'ajuste',
  MERMA: 'merma',
  DEVOLUCION: 'devolucion',
}

export const ETIQUETAS_MOVIMIENTO = {
  [TIPOS_MOVIMIENTO.ENTRADA]: 'Entrada',
  [TIPOS_MOVIMIENTO.SALIDA]: 'Salida',
  [TIPOS_MOVIMIENTO.AJUSTE]: 'Ajuste',
  [TIPOS_MOVIMIENTO.MERMA]: 'Merma',
  [TIPOS_MOVIMIENTO.DEVOLUCION]: 'Devolución',
}

export const COLORES_MOVIMIENTO = {
  [TIPOS_MOVIMIENTO.ENTRADA]: 'verde',
  [TIPOS_MOVIMIENTO.SALIDA]: 'azul',
  [TIPOS_MOVIMIENTO.AJUSTE]: 'amarillo',
  [TIPOS_MOVIMIENTO.MERMA]: 'rojo',
  [TIPOS_MOVIMIENTO.DEVOLUCION]: 'morado',
}

export const OPCIONES_MOVIMIENTO = Object.entries(ETIQUETAS_MOVIMIENTO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))
