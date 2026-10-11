export const formasFarmaceuticas = [
  { id: 'ff-001', nombre: 'tableta' },
  { id: 'ff-002', nombre: 'cápsula' },
  { id: 'ff-003', nombre: 'jarabe' },
  { id: 'ff-004', nombre: 'crema' },
  { id: 'ff-005', nombre: 'suspensión' },
  { id: 'ff-006', nombre: 'inyectable' },
  { id: 'ff-007', nombre: 'solución' },
  { id: 'ff-008', nombre: 'ungüento' },
  { id: 'ff-009', nombre: 'polvo' },
  { id: 'ff-010', nombre: 'supositorio' },
  { id: 'ff-011', nombre: 'colirio' },
  { id: 'ff-012', nombre: 'inhalador' },
  { id: 'ff-013', nombre: 'parche' },
  { id: 'ff-014', nombre: 'gel' },
  { id: 'ff-015', nombre: 'óvulo' },
]

export const OPCIONES_FORMAS_FARMACEUTICAS = formasFarmaceuticas.map(ff => ({
  valor: ff.id,
  etiqueta: ff.nombre.charAt(0).toUpperCase() + ff.nombre.slice(1),
}))
