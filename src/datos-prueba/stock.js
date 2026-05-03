/**
 * Datos de prueba: Stock por producto y ubicación.
 * Al menos 15 registros cubriendo droguería y ambas boticas.
 */
export const stock = [
  // Droguería Central
  { id: 'stk-001', productoId: 'prod-001', ubicacionId: 'ub-001', stockDisponible: 450, stockMinimo: 100, ultimaActualizacion: '2026-05-03T10:00:00' },
  { id: 'stk-002', productoId: 'prod-002', ubicacionId: 'ub-001', stockDisponible: 200, stockMinimo: 80, ultimaActualizacion: '2026-05-03T09:30:00' },
  { id: 'stk-003', productoId: 'prod-003', ubicacionId: 'ub-001', stockDisponible: 320, stockMinimo: 60, ultimaActualizacion: '2026-05-02T14:00:00' },
  { id: 'stk-004', productoId: 'prod-004', ubicacionId: 'ub-001', stockDisponible: 15, stockMinimo: 50, ultimaActualizacion: '2026-05-03T08:00:00' },
  { id: 'stk-005', productoId: 'prod-005', ubicacionId: 'ub-001', stockDisponible: 180, stockMinimo: 40, ultimaActualizacion: '2026-05-01T16:00:00' },
  { id: 'stk-006', productoId: 'prod-006', ubicacionId: 'ub-001', stockDisponible: 0, stockMinimo: 60, ultimaActualizacion: '2026-05-03T07:00:00' },

  // Botica Miraflores
  { id: 'stk-007', productoId: 'prod-001', ubicacionId: 'ub-002', stockDisponible: 85, stockMinimo: 30, ultimaActualizacion: '2026-05-03T11:00:00' },
  { id: 'stk-008', productoId: 'prod-002', ubicacionId: 'ub-002', stockDisponible: 12, stockMinimo: 20, ultimaActualizacion: '2026-05-02T17:00:00' },
  { id: 'stk-009', productoId: 'prod-003', ubicacionId: 'ub-002', stockDisponible: 45, stockMinimo: 15, ultimaActualizacion: '2026-05-03T09:00:00' },
  { id: 'stk-010', productoId: 'prod-007', ubicacionId: 'ub-002', stockDisponible: 500, stockMinimo: 25, ultimaActualizacion: '2026-05-01T10:00:00' },
  { id: 'stk-011', productoId: 'prod-009', ubicacionId: 'ub-002', stockDisponible: 0, stockMinimo: 15, ultimaActualizacion: '2026-05-02T12:00:00' },

  // Botica San Borja
  { id: 'stk-012', productoId: 'prod-001', ubicacionId: 'ub-003', stockDisponible: 60, stockMinimo: 25, ultimaActualizacion: '2026-05-03T10:30:00' },
  { id: 'stk-013', productoId: 'prod-004', ubicacionId: 'ub-003', stockDisponible: 8, stockMinimo: 20, ultimaActualizacion: '2026-05-02T15:00:00' },
  { id: 'stk-014', productoId: 'prod-005', ubicacionId: 'ub-003', stockDisponible: 35, stockMinimo: 10, ultimaActualizacion: '2026-05-03T08:30:00' },
  { id: 'stk-015', productoId: 'prod-008', ubicacionId: 'ub-003', stockDisponible: 22, stockMinimo: 10, ultimaActualizacion: '2026-05-01T14:00:00' },
  { id: 'stk-016', productoId: 'prod-010', ubicacionId: 'ub-003', stockDisponible: 40, stockMinimo: 12, ultimaActualizacion: '2026-05-02T09:00:00' },
]
