/**
 * Datos de prueba: Organizaciones (empresas propietarias de la red).
 * Alineado con Arquitectura Lógica v4 — tabla organizaciones.
 */
export const organizaciones = [
  {
    id: 'org-001',
    nombre: 'D&R Farma S.A.C.',
    tipoIdentificacion: 'ruc',
    numeroIdentificacion: '20123456789',
    paisOrigen: 'PE',
    createdAt: '2024-01-01T08:00:00',
  },
  {
    id: 'org-002',
    nombre: 'PharmaCorp International',
    tipoIdentificacion: 'vat',
    numeroIdentificacion: 'US123456789',
    paisOrigen: 'US',
    createdAt: '2024-02-15T09:00:00',
  },
  {
    id: 'org-003',
    nombre: 'Medicamentos India Pvt Ltd',
    tipoIdentificacion: 'tax_id',
    numeroIdentificacion: 'IN27AAAAU9613G1ZQ',
    paisOrigen: 'IN',
    createdAt: '2024-03-01T10:00:00',
  },
]

export const TIPOS_IDENTIFICACION = {
  RUC: 'ruc',
  NIT: 'nit',
  TAX_ID: 'tax_id',
  VAT: 'vat',
  OTRO: 'otro',
}

export const ETIQUETAS_IDENTIFICACION = {
  [TIPOS_IDENTIFICACION.RUC]: 'RUC (Perú)',
  [TIPOS_IDENTIFICACION.NIT]: 'NIT (Centroamérica)',
  [TIPOS_IDENTIFICACION.TAX_ID]: 'Tax ID (Internacional)',
  [TIPOS_IDENTIFICACION.VAT]: 'VAT (Unión Europea)',
  [TIPOS_IDENTIFICACION.OTRO]: 'Otro',
}

export const OPCIONES_IDENTIFICACION = Object.entries(ETIQUETAS_IDENTIFICACION).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))