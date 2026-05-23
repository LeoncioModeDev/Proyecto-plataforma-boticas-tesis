/**
 * Tipos de alerta del sistema con colores asociados.
 */
export const TIPOS_ALERTA = {
  QUIEBRE: 'quiebre',
  SOBRESTOCK: 'sobrestock',
  VENCIMIENTO: 'vencimiento',
  PREDICCION: 'prediccion',
}

export const ETIQUETAS_ALERTA = {
  [TIPOS_ALERTA.QUIEBRE]: 'Quiebre de Stock',
  [TIPOS_ALERTA.SOBRESTOCK]: 'Sobrestock',
  [TIPOS_ALERTA.VENCIMIENTO]: 'Próximo a Vencer',
  [TIPOS_ALERTA.PREDICCION]: 'Alerta Predictiva',
}

export const COLORES_ALERTA = {
  [TIPOS_ALERTA.QUIEBRE]: 'rojo',
  [TIPOS_ALERTA.SOBRESTOCK]: 'azul',
  [TIPOS_ALERTA.VENCIMIENTO]: 'amarillo',
  [TIPOS_ALERTA.PREDICCION]: 'verde',
}
