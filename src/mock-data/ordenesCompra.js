let ordenIdCounter = 7

export const ordenesCompra = [
  {
    id: 'OC-001',
    proveedorId: 'prov-001',
    proveedorNombre: 'Droguería Perú SAC',
    estado: 'pendiente',
    creadoPor: 'usr-002',
    creadoPorNombre: 'Ana Torres',
    fechaEstimadaEntrega: '2026-06-15',
    observaciones: 'Urgente para reposición de antibióticos',
    aprobadoPor: null,
    fechaAprobacion: null,
    items: [
      { productoId: 'prod-002', productoNombre: 'Amoxicilina 500mg', cantidad: 200, precioUnitario: 12.50 },
      { productoId: 'prod-004', productoNombre: 'Omeprazol 20mg', cantidad: 150, precioUnitario: 8.90 },
    ],
    createdAt: '2026-05-15T10:00:00',
  },
  {
    id: 'OC-002',
    proveedorId: 'prov-003',
    proveedorNombre: 'Laboratorios Medifarma',
    estado: 'aprobada',
    creadoPor: 'usr-005',
    creadoPorNombre: 'José Ramírez',
    fechaEstimadaEntrega: '2026-06-20',
    observaciones: '',
    aprobadoPor: 'usr-001',
    fechaAprobacion: '2026-05-16T14:00:00',
    items: [
      { productoId: 'prod-001', productoNombre: 'Paracetamol 500mg', cantidad: 500, precioUnitario: 5.20 },
      { productoId: 'prod-003', productoNombre: 'Ibuprofeno 400mg', cantidad: 300, precioUnitario: 6.80 },
      { productoId: 'prod-007', productoNombre: 'Cetirizina 10mg', cantidad: 200, precioUnitario: 4.50 },
    ],
    createdAt: '2026-05-14T09:30:00',
  },
  {
    id: 'OC-003',
    proveedorId: 'prov-004',
    proveedorNombre: 'Corporación Farmacéutica',
    estado: 'recibida',
    creadoPor: 'usr-002',
    creadoPorNombre: 'Ana Torres',
    fechaEstimadaEntrega: '2026-05-30',
    observaciones: 'Pedido trimestral',
    aprobadoPor: 'usr-001',
    fechaAprobacion: '2026-05-13T11:00:00',
    items: [
      { productoId: 'prod-005', productoNombre: 'Losartán 50mg', cantidad: 400, precioUnitario: 15.00 },
      { productoId: 'prod-006', productoNombre: 'Metformina 850mg', cantidad: 350, precioUnitario: 10.20 },
      { productoId: 'prod-009', productoNombre: 'Azitromicina 500mg', cantidad: 180, precioUnitario: 18.50 },
      { productoId: 'prod-010', productoNombre: 'Ambroxol Jarabe', cantidad: 120, precioUnitario: 7.30 },
    ],
    createdAt: '2026-05-12T08:00:00',
  },
  {
    id: 'OC-004',
    proveedorId: 'prov-005',
    proveedorNombre: 'Distribuidora Pharmalife',
    estado: 'pendiente',
    creadoPor: 'usr-005',
    creadoPorNombre: 'José Ramírez',
    fechaEstimadaEntrega: '2026-06-10',
    observaciones: '',
    aprobadoPor: null,
    fechaAprobacion: null,
    items: [
      { productoId: 'prod-008', productoNombre: 'Diclofenaco Gel 1%', cantidad: 100, precioUnitario: 9.00 },
    ],
    createdAt: '2026-05-10T15:00:00',
  },
  {
    id: 'OC-005',
    proveedorId: 'prov-001',
    proveedorNombre: 'Droguería Perú SAC',
    estado: 'rechazada',
    creadoPor: 'usr-002',
    creadoPorNombre: 'Ana Torres',
    fechaEstimadaEntrega: '2026-05-25',
    observaciones: 'Rechazado por presupuesto excedido',
    aprobadoPor: 'usr-007',
    fechaAprobacion: '2026-05-09T16:00:00',
    items: [
      { productoId: 'prod-004', productoNombre: 'Omeprazol 20mg', cantidad: 300, precioUnitario: 8.90 },
    ],
    createdAt: '2026-05-08T11:00:00',
  },
  {
    id: 'OC-006',
    proveedorId: 'prov-007',
    proveedorNombre: 'Grupo Farmalim',
    estado: 'recibida',
    creadoPor: 'usr-005',
    creadoPorNombre: 'José Ramírez',
    fechaEstimadaEntrega: '2026-05-05',
    observaciones: '',
    aprobadoPor: 'usr-001',
    fechaAprobacion: '2026-04-28T10:00:00',
    items: [
      { productoId: 'prod-001', productoNombre: 'Paracetamol 500mg', cantidad: 1000, precioUnitario: 4.80 },
      { productoId: 'prod-003', productoNombre: 'Ibuprofeno 400mg', cantidad: 600, precioUnitario: 6.50 },
    ],
    createdAt: '2026-04-25T09:00:00',
  },
]

export function generarIdOC() {
  return `OC-${String(ordenIdCounter++).padStart(3, '0')}`
}

export const ESTADOS_OC = {
  pendiente: { etiqueta: 'Pendiente', color: 'amarillo' },
  aprobada: { etiqueta: 'Aprobada', color: 'azul' },
  rechazada: { etiqueta: 'Rechazada', color: 'rojo' },
  recibida: { etiqueta: 'Recibida', color: 'verde' },
}

export function calcularTotal(items) {
  return items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0)
}
