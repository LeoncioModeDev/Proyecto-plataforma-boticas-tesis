/**
 * Estados posibles de un producto en el catálogo.
 */
export const ESTADO_PRODUCTO = {
  ACTIVO: 'activo',
  INACTIVO: 'inactivo',
  DESCONTINUADO: 'descontinuado',
}

export const ETIQUETAS_ESTADO = {
  [ESTADO_PRODUCTO.ACTIVO]: 'Activo',
  [ESTADO_PRODUCTO.INACTIVO]: 'Inactivo',
  [ESTADO_PRODUCTO.DESCONTINUADO]: 'Descontinuado',
}

export const COLORES_ESTADO = {
  [ESTADO_PRODUCTO.ACTIVO]: 'verde',
  [ESTADO_PRODUCTO.INACTIVO]: 'gris',
  [ESTADO_PRODUCTO.DESCONTINUADO]: 'rojo',
}

export const OPCIONES_ESTADO = Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))
