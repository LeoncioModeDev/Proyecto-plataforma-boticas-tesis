import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Building, Phone } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { proveedores as proveedoresMock } from '@/mock-data/proveedores'

export default function PaginaProveedores() {
  const navegar = useNavigate()
  const [proveedores] = useState(proveedoresMock)

  const activos = proveedores.filter(p => p.estado === 'activo').length

  const columnas = [
    {
      campo: 'razonSocial', encabezado: 'Razón Social',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-marca-claro rounded">
            <Building className="h-4 w-4 text-marca-principal" />
          </div>
          <div>
            <p className="font-medium text-principal">{r.razonSocial}</p>
            <p className="text-xs text-secundario">{r.nombreComercial}</p>
          </div>
        </div>
      ),
    },
    { campo: 'numeroIdentificacion', encabezado: 'Identificación', render: (r) => <span className="font-mono text-cuerpo">{r.numeroIdentificacion}</span> },
    { campo: 'contacto', encabezado: 'Contacto', render: (r) => <span>{r.contacto}</span> },
    { campo: 'telefono', encabezado: 'Teléfono', render: (r) => <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-secundario" />{r.telefono}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={r.estado === 'activo' ? 'verde' : 'gris'}>{r.estado}</Insignia> },
    {
      campo: 'acciones', encabezado: 'Acciones',
      render: () => <Boton variante="icono" icono={Edit} title="Editar" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Proveedores</h1>
          <p className="text-secundario mt-1">Gestión de proveedores de la red</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/proveedores/nuevo')}>Nuevo proveedor</Boton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Total Proveedores" valor={proveedores.length} icono={Building} />
        <TarjetaMetrica etiqueta="Activos" valor={activos} icono={Building} />
      </div>
      <Tabla columnas={columnas} datos={proveedores} />
    </div>
  )
}
