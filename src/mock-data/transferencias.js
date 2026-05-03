/**
 * Datos de prueba: Transferencias entre droguería y boticas.
 * Al menos 5 transferencias en distintos estados.
 */
export const transferencias = [
  {
    id: 'tr-001',
    origenId: 'ub-001',
    destinoId: 'ub-002',
    estado: 'completada',
    fechaCreacion: '2024-09-10T14:00:00',
    fechaRecepcion: '2024-09-11T09:00:00',
    usuarioCreador: 'usr-001',
    usuarioReceptor: 'usr-002',
    items: [
      { productoId: 'prod-001', loteId: 'lot-001', cantidad: 50 },
    ],
    observaciones: 'Reposición regular de Paracetamol',
  },
  {
    id: 'tr-002',
    origenId: 'ub-001',
    destinoId: 'ub-002',
    estado: 'completada',
    fechaCreacion: '2024-10-01T11:00:00',
    fechaRecepcion: '2024-10-02T10:00:00',
    usuarioCreador: 'usr-001',
    usuarioReceptor: 'usr-002',
    items: [
      { productoId: 'prod-002', loteId: 'lot-003', cantidad: 30 },
    ],
    observaciones: 'Reposición de Amoxicilina por bajo stock',
  },
  {
    id: 'tr-003',
    origenId: 'ub-001',
    destinoId: 'ub-002',
    estado: 'en_transito',
    fechaCreacion: '2026-05-02T16:00:00',
    fechaRecepcion: null,
    usuarioCreador: 'usr-001',
    usuarioReceptor: null,
    items: [
      { productoId: 'prod-004', loteId: 'lot-006', cantidad: 10 },
      { productoId: 'prod-009', loteId: 'lot-010', cantidad: 20 },
    ],
    observaciones: 'Envío urgente por quiebre de stock en Miraflores',
  },
  {
    id: 'tr-004',
    origenId: 'ub-001',
    destinoId: 'ub-003',
    estado: 'pendiente',
    fechaCreacion: '2026-05-03T08:00:00',
    fechaRecepcion: null,
    usuarioCreador: 'usr-001',
    usuarioReceptor: null,
    items: [
      { productoId: 'prod-004', loteId: 'lot-006', cantidad: 5 },
      { productoId: 'prod-001', loteId: 'lot-002', cantidad: 30 },
    ],
    observaciones: 'Reposición semanal programada para San Borja',
  },
  {
    id: 'tr-005',
    origenId: 'ub-001',
    destinoId: 'ub-003',
    estado: 'completada',
    fechaCreacion: '2025-02-25T10:00:00',
    fechaRecepcion: '2025-02-28T10:30:00',
    usuarioCreador: 'usr-001',
    usuarioReceptor: 'usr-003',
    items: [
      { productoId: 'prod-001', loteId: 'lot-002', cantidad: 60 },
    ],
    observaciones: 'Transferencia inicial de apertura para San Borja',
  },
  {
    id: 'tr-006',
    origenId: 'ub-001',
    destinoId: 'ub-003',
    estado: 'cancelada',
    fechaCreacion: '2026-04-28T09:00:00',
    fechaRecepcion: null,
    usuarioCreador: 'usr-001',
    usuarioReceptor: null,
    items: [
      { productoId: 'prod-006', loteId: null, cantidad: 30 },
    ],
    observaciones: 'Cancelada — sin stock disponible de Metformina en droguería',
  },
]
