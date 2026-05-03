/**
 * Roles del sistema y sus etiquetas legibles.
 */
export const ROLES = {
  ADMIN_CENTRAL: 'admin_central',
  OPERADOR_DROGUERIA: 'operador_drogueria',
  VISOR_BOTICA: 'visor_botica',
}

export const ETIQUETAS_ROLES = {
  [ROLES.ADMIN_CENTRAL]: 'Admin Central',
  [ROLES.OPERADOR_DROGUERIA]: 'Operador de Droguería',
  [ROLES.VISOR_BOTICA]: 'Visor de Botica',
}

export const OPCIONES_ROLES = Object.entries(ETIQUETAS_ROLES).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))
