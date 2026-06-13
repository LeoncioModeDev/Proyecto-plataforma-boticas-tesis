import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Building, Phone, Star } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { proveedores as proveedoresMock } from '@/mock-data/proveedores'
import { contactosProveedor as contactosMock } from '@/mock-data/contactos-proveedor'

function obtenerContactoPrincipal(proveedorId) {
  return contactosMock.find(c => c.proveedorId === proveedorId && c.principal)
    || contactosMock.find(c => c.proveedorId === proveedorId)
}

export default function PaginaProveedores() {
  const navegar = useNavigate()
  const [proveedores] = useState(proveedoresMock)

  const activos = proveedores.filter(p => p.activo).length

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    {
      campo: 'razonSocial', encabezado: 'Razón Social',
      render: (r) => {
        const contacto = obtenerContactoPrincipal(r.id)
        return (
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-marca-claro rounded">
              <Building className="h-4 w-4 text-marca-principal" />
            </div>
            <div>
              <p className="font-medium text-principal">{r.razonSocial}</p>
              {contacto && <p className="text-xs text-secundario">{contacto.nombre}</p>}
            </div>
          </div>
        )
      },
    },
    { campo: 'numeroIdentificacion', encabezado: 'Identificación', render: (r) => <span className="font-mono text-cuerpo">{r.numeroIdentificacion}</span> },
    {
      campo: 'contacto', encabezado: 'Contacto',
      render: (r) => {
        const contacto = obtenerContactoPrincipal(r.id)
        if (!contacto) return <span className="text-secundario">—</span>
        return (
          <span className="flex items-center gap-1">
            {contacto.nombre}
            {contacto.principal && <Star className="h-3 w-3 text-estado-exito" />}
          </span>
        )
      },
    },
    {
      campo: 'telefono', encabezado: 'Teléfono',
      render: (r) => {
        const contacto = obtenerContactoPrincipal(r.id)
        return contacto?.telefono
          ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-secundario" />{contacto.telefono}</span>
          : <span className="text-secundario">—</span>
      },
    },
    { campo: 'activo', encabezado: 'Estado', render: (r) => <Insignia color={r.activo ? 'verde' : 'gris'}>{r.activo ? 'Activo' : 'Inactivo'}</Insignia> },
    {
      campo: 'acciones', encabezado: 'Acciones',
      render: (r) => <Boton variante="icono" icono={Edit} title="Editar" onClick={(e) => { e.stopPropagation(); navegar(`/operaciones/proveedores/${r.id}/editar`) }} />,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TarjetaMetrica etiqueta="Total Proveedores" valor={proveedores.length} icono={Building} />
        <TarjetaMetrica etiqueta="Activos" valor={activos} icono={Building} />
      </div>
      <Tabla columnas={columnas} datos={proveedores} alClickFila={(p) => navegar(`/operaciones/proveedores/${p.id}`)} />
    </div>
  )
}
