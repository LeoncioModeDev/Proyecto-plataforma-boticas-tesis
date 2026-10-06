/**
 * Tipos de alerta del sistema con colores asociados.
 */
export const TIPOS_ALERTA = {
  QUIEBRE: 'quiebre',
  SOBRESTOCK: 'sobrestock',
  STOCK_CRITICO: 'stock_critico',
  STOCK_BAJO: 'stock_bajo',
  VENCIMIENTO: 'vencimiento',
  PREDICCION: 'prediccion',
  RETRASO_RECEPCION: 'retraso_recepcion',
  RETRASO_TRANSFERENCIA: 'retraso_transferencia',
  RIESGO_DESABASTECIMIENTO: 'riesgo_desabastecimiento',
  RIESGO_STOCK_SEGURIDAD: 'riesgo_stock_seguridad',
  AUMENTO_DEMANDA: 'aumento_demanda',
  STOCKOUT_INMINENTE: 'stockout_inminente',
  COMPRA_URGENTE: 'compra_urgente',
  REPOSICION_RECOMENDADA: 'reposicion_recomendada',
  VENCIMIENTO_PROXIMO: 'vencimiento_proximo',
}

export const ETIQUETAS_ALERTA = {
  [TIPOS_ALERTA.QUIEBRE]: 'Quiebre de Stock',
  [TIPOS_ALERTA.SOBRESTOCK]: 'Sobrestock',
  [TIPOS_ALERTA.STOCK_CRITICO]: 'Stock crítico',
  [TIPOS_ALERTA.STOCK_BAJO]: 'Stock bajo',
  [TIPOS_ALERTA.VENCIMIENTO]: 'Próximo a Vencer',
  [TIPOS_ALERTA.PREDICCION]: 'Alerta Predictiva',
  [TIPOS_ALERTA.RETRASO_RECEPCION]: 'Recepción retrasada',
  [TIPOS_ALERTA.RETRASO_TRANSFERENCIA]: 'Transferencia retrasada',
  [TIPOS_ALERTA.RIESGO_DESABASTECIMIENTO]: 'Riesgo de desabastecimiento',
  [TIPOS_ALERTA.RIESGO_STOCK_SEGURIDAD]: 'Riesgo bajo stock seguridad',
  [TIPOS_ALERTA.AUMENTO_DEMANDA]: 'Aumento de demanda',
  [TIPOS_ALERTA.STOCKOUT_INMINENTE]: 'Riesgo de desabastecimiento',
  [TIPOS_ALERTA.COMPRA_URGENTE]: 'Compra urgente',
  [TIPOS_ALERTA.REPOSICION_RECOMENDADA]: 'Reposición recomendada',
  [TIPOS_ALERTA.VENCIMIENTO_PROXIMO]: 'Próximo vencimiento',
}

export const COLORES_ALERTA = {
  [TIPOS_ALERTA.QUIEBRE]: 'rojo',
  [TIPOS_ALERTA.SOBRESTOCK]: 'azul',
  [TIPOS_ALERTA.STOCK_CRITICO]: 'rojo',
  [TIPOS_ALERTA.STOCK_BAJO]: 'amarillo',
  [TIPOS_ALERTA.VENCIMIENTO]: 'amarillo',
  [TIPOS_ALERTA.PREDICCION]: 'verde',
  [TIPOS_ALERTA.RETRASO_RECEPCION]: 'amarillo',
  [TIPOS_ALERTA.RETRASO_TRANSFERENCIA]: 'amarillo',
  [TIPOS_ALERTA.RIESGO_DESABASTECIMIENTO]: 'rojo',
  [TIPOS_ALERTA.RIESGO_STOCK_SEGURIDAD]: 'amarillo',
  [TIPOS_ALERTA.AUMENTO_DEMANDA]: 'azul',
  [TIPOS_ALERTA.STOCKOUT_INMINENTE]: 'rojo',
  [TIPOS_ALERTA.COMPRA_URGENTE]: 'rojo',
  [TIPOS_ALERTA.REPOSICION_RECOMENDADA]: 'amarillo',
  [TIPOS_ALERTA.VENCIMIENTO_PROXIMO]: 'amarillo',
}
