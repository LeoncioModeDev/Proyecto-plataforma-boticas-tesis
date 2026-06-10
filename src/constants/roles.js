/**
 * Roles del sistema y sus etiquetas legibles.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_CENTRAL: 'admin_central',
  OPERADOR_DROGUERIA: 'operador_drogueria',
  VISOR_BOTICA: 'visor_botica',
}

export const ETIQUETAS_ROLES = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN_CENTRAL]: 'Admin Central',
  [ROLES.OPERADOR_DROGUERIA]: 'Operador Logístico Central',
  [ROLES.VISOR_BOTICA]: 'Visor de Botica',
}

export const OPCIONES_ROLES = Object.entries(ETIQUETAS_ROLES).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))
