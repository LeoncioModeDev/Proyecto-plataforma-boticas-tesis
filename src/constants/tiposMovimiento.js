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

export const DIRECCION_AJUSTE = {
  INCREMENTO: 'incremento',
  DECREMENTO: 'decremento',
}

export const ETIQUETAS_DIRECCION = {
  [DIRECCION_AJUSTE.INCREMENTO]: 'Incremento',
  [DIRECCION_AJUSTE.DECREMENTO]: 'Decremento',
}

export const COLORES_DIRECCION = {
  [DIRECCION_AJUSTE.INCREMENTO]: 'verde',
  [DIRECCION_AJUSTE.DECREMENTO]: 'rojo',
}

export const SUBTIPOS_AJUSTE = [
  { valor: 'ajuste_positivo', etiqueta: 'Ajuste Positivo', color: 'verde', descripcion: 'Corrige stock al alza' },
  { valor: 'ajuste_negativo', etiqueta: 'Ajuste Negativo', color: 'rojo', descripcion: 'Corrige stock a la baja' },
  { valor: 'merma_vencimiento', etiqueta: 'Merma por Vencimiento', color: 'naranja', descripcion: 'Producto vencido' },
  { valor: 'merma_dano', etiqueta: 'Merma por Daño', color: 'naranja', descripcion: 'Producto dañado o deteriorado' },
  { valor: 'merma_perdida', etiqueta: 'Merma por Pérdida', color: 'naranja', descripcion: 'Producto perdido o extraviado' },
]
