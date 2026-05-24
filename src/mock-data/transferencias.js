/**
 * Datos de prueba: Transferencias entre droguería y boticas, y redistribución entre boticas.
 * Alineado con Arquitectura Lógica v4 — tablas transferencias y transferencias_items.
 */
export const transferencias = [
  {
    id: 'trans-001',
    tipoTransferencia: 'transferencia_central',
    origenTipo: 'drogueria',
    origenId: 'ub-001',
    destinoTipo: 'botica',
    destinoId: 'ub-002',
    estado: 'recibida',
    creadoPor: 'usr-001',
    fechaDespacho: '2024-09-11T09:00:00',
    fechaRecepcion: '2024-09-11T09:00:00',
    createdAt: '2024-09-10T14:00:00',
    items: [
      { id: 'ti-001', transferenciaId: 'trans-001', productoId: 'prod-001', loteId: 'lot-001', cantidad: 50 },
    ],
  },
  {
    id: 'trans-002',
    tipoTransferencia: 'transferencia_central',
    origenTipo: 'drogueria',
    origenId: 'ub-001',
    destinoTipo: 'botica',
    destinoId: 'ub-002',
    estado: 'recibida',
    creadoPor: 'usr-001',
    fechaDespacho: '2024-10-02T10:00:00',
    fechaRecepcion: '2024-10-02T10:00:00',
    createdAt: '2024-10-01T11:00:00',
    items: [
      { id: 'ti-002', transferenciaId: 'trans-002', productoId: 'prod-002', loteId: 'lot-003', cantidad: 30 },
    ],
  },
  {
    id: 'trans-003',
    tipoTransferencia: 'transferencia_central',
    origenTipo: 'drogueria',
    origenId: 'ub-001',
    destinoTipo: 'botica',
    destinoId: 'ub-002',
    estado: 'en_transito',
    creadoPor: 'usr-001',
    fechaDespacho: '2026-05-02T16:00:00',
    fechaRecepcion: null,
    createdAt: '2026-05-02T16:00:00',
    items: [
      { id: 'ti-003', transferenciaId: 'trans-003', productoId: 'prod-004', loteId: 'lot-006', cantidad: 10 },
      { id: 'ti-004', transferenciaId: 'trans-003', productoId: 'prod-009', loteId: 'lot-010', cantidad: 20 },
    ],
  },
  {
    id: 'trans-004',
    tipoTransferencia: 'transferencia_central',
    origenTipo: 'drogueria',
    origenId: 'ub-001',
    destinoTipo: 'botica',
    destinoId: 'ub-003',
    estado: 'en_transito',
    creadoPor: 'usr-001',
    fechaDespacho: '2026-05-22T10:00:00',
    fechaRecepcion: null,
    createdAt: '2026-05-21T08:00:00',
    items: [
      { id: 'ti-005', transferenciaId: 'trans-004', productoId: 'prod-004', loteId: 'lot-006', cantidad: 5 },
      { id: 'ti-006', transferenciaId: 'trans-004', productoId: 'prod-001', loteId: 'lot-002', cantidad: 30 },
    ],
  },
  {
    id: 'trans-005',
    tipoTransferencia: 'transferencia_central',
    origenTipo: 'drogueria',
    origenId: 'ub-001',
    destinoTipo: 'botica',
    destinoId: 'ub-003',
    estado: 'recibida',
    creadoPor: 'usr-001',
    fechaDespacho: '2025-02-28T10:00:00',
    fechaRecepcion: '2025-02-28T10:30:00',
    createdAt: '2025-02-25T10:00:00',
    items: [
      { id: 'ti-007', transferenciaId: 'trans-005', productoId: 'prod-001', loteId: 'lot-002', cantidad: 60 },
    ],
  },
  {
    id: 'trans-006',
    tipoTransferencia: 'redistribucion',
    origenTipo: 'botica',
    origenId: 'ub-002',
    destinoTipo: 'botica',
    destinoId: 'ub-003',
    estado: 'cancelada',
    creadoPor: 'usr-002',
    fechaDespacho: null,
    fechaRecepcion: null,
    createdAt: '2026-05-10T10:00:00',
    items: [
      { id: 'ti-008', transferenciaId: 'trans-006', productoId: 'prod-007', loteId: 'lot-008', cantidad: 50 },
    ],
  },
]

export const ESTADOS_TRANSFERENCIA = {
  CREADA: 'creada',
  EN_TRANSITO: 'en_transito',
  RECIBIDA: 'recibida',
  CANCELADA: 'cancelada',
}

export const ETIQUETAS_TRANSFERENCIA = {
  [ESTADOS_TRANSFERENCIA.CREADA]: 'Creada',
  [ESTADOS_TRANSFERENCIA.EN_TRANSITO]: 'En Tránsito',
  [ESTADOS_TRANSFERENCIA.RECIBIDA]: 'Recibida',
  [ESTADOS_TRANSFERENCIA.CANCELADA]: 'Cancelada',
}

export const COLORES_TRANSFERENCIA = {
  [ESTADOS_TRANSFERENCIA.CREADA]: 'amarillo',
  [ESTADOS_TRANSFERENCIA.EN_TRANSITO]: 'azul',
  [ESTADOS_TRANSFERENCIA.RECIBIDA]: 'verde',
  [ESTADOS_TRANSFERENCIA.CANCELADA]: 'rojo',
}