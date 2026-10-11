/**
 * Clasificaciones de productos farmacéuticos.
 * Alineado con Arquitectura Lógica v4 — productos.clasificacion enum.
 */
export const CLASIFICACION_PRODUCTO = {
  OTC: 'OTC',
  RECETA: 'receta',
  GENERICO: 'generico',
}

export const ETIQUETAS_CLASIFICACION = {
  [CLASIFICACION_PRODUCTO.OTC]: 'Venta Libre (OTC)',
  [CLASIFICACION_PRODUCTO.RECETA]: 'Con Receta',
  [CLASIFICACION_PRODUCTO.GENERICO]: 'Genérico',
}

export const COLORES_CLASIFICACION = {
  [CLASIFICACION_PRODUCTO.OTC]: 'azul',
  [CLASIFICACION_PRODUCTO.RECETA]: 'amarillo',
  [CLASIFICACION_PRODUCTO.GENERICO]: 'verde',
}

export const OPCIONES_CLASIFICACION = Object.entries(ETIQUETAS_CLASIFICACION).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))