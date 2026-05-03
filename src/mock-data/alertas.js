/**
 * Datos de prueba: Alertas activas del sistema.
 */
export const alertas = [
  { id: 'alr-001', tipo: 'quiebre', productoId: 'prod-006', ubicacionId: 'ub-001', mensaje: 'Metformina 850mg sin stock en Droguería Central', urgencia: 'critica', leida: false, fechaCreacion: '2026-05-03T07:00:00' },
  { id: 'alr-002', tipo: 'quiebre', productoId: 'prod-009', ubicacionId: 'ub-002', mensaje: 'Azitromicina 500mg sin stock en Botica Miraflores', urgencia: 'critica', leida: false, fechaCreacion: '2026-05-02T12:00:00' },
  { id: 'alr-003', tipo: 'vencimiento', productoId: 'prod-004', ubicacionId: 'ub-001', mensaje: 'Omeprazol 20mg (Lote LT-2024-006) vence en 7 días', urgencia: 'critica', leida: false, fechaCreacion: '2026-05-03T06:00:00', loteId: 'lot-006' },
  { id: 'alr-004', tipo: 'vencimiento', productoId: 'prod-002', ubicacionId: 'ub-001', mensaje: 'Amoxicilina 500mg (Lote LT-2024-003) vence en 17 días', urgencia: 'alta', leida: false, fechaCreacion: '2026-05-03T06:00:00', loteId: 'lot-003' },
  { id: 'alr-005', tipo: 'vencimiento', productoId: 'prod-001', ubicacionId: 'ub-003', mensaje: 'Paracetamol 500mg (Lote LT-2025-005) vence en 25 días', urgencia: 'media', leida: true, fechaCreacion: '2026-05-01T06:00:00', loteId: 'lot-011' },
  { id: 'alr-006', tipo: 'quiebre', productoId: 'prod-004', ubicacionId: 'ub-001', mensaje: 'Omeprazol 20mg bajo stock (15/50) en Droguería Central', urgencia: 'alta', leida: false, fechaCreacion: '2026-05-03T08:00:00' },
  { id: 'alr-007', tipo: 'sobrestock', productoId: 'prod-007', ubicacionId: 'ub-002', mensaje: 'Cetirizina 10mg sobrestock (500/25) en Botica Miraflores', urgencia: 'baja', leida: true, fechaCreacion: '2026-05-01T10:00:00' },
  { id: 'alr-008', tipo: 'prediccion', productoId: 'prod-001', ubicacionId: 'ub-002', mensaje: 'Quiebre predicho de Paracetamol en Miraflores — semana del 19 de mayo', urgencia: 'alta', leida: false, fechaCreacion: '2026-05-03T05:00:00' },
  { id: 'alr-009', tipo: 'prediccion', productoId: 'prod-002', ubicacionId: 'ub-002', mensaje: 'Demanda de Amoxicilina incrementará 40% en junio', urgencia: 'media', leida: false, fechaCreacion: '2026-05-02T05:00:00' },
]
