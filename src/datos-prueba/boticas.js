/**
 * Datos de prueba: Ubicaciones (droguería y boticas).
 */
export const boticas = [
  {
    id: 'ub-001',
    nombre: 'Droguería Central',
    tipo: 'drogueria',
    direccion: 'Av. Abancay 234, Cercado de Lima',
    telefono: '01-4567890',
    encargado: 'Carlos Mendoza',
    activa: true,
  },
  {
    id: 'ub-002',
    nombre: 'Botica Miraflores',
    tipo: 'botica',
    direccion: 'Calle Schell 412, Miraflores',
    telefono: '01-2345678',
    encargado: 'Ana Torres',
    activa: true,
  },
  {
    id: 'ub-003',
    nombre: 'Botica San Borja',
    tipo: 'botica',
    direccion: 'Av. San Luis 1890, San Borja',
    telefono: '01-3456789',
    encargado: 'Luis García',
    activa: true,
  },
]

export const OPCIONES_UBICACION = boticas.map(b => ({
  valor: b.id,
  etiqueta: b.nombre,
}))
