import { useState } from 'react'
import { Plus, ClipboardList, CheckCircle, Clock } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'

const ordenesMock = [
  { id: 'OC-001', proveedor: 'Droguería Perú SAC', fecha: '2026-05-15', items: 8, total: 12500.00, estado: 'pendiente' },
  { id: 'OC-002', proveedor: 'Laboratorios Medifarma', fecha: '2026-05-14', items: 5, total: 8900.00, estado: 'aprobada' },
  { id: 'OC-003', proveedor: 'Corporación Farmacéutica', fecha: '2026-05-12', items: 12, total: 22300.00, estado: 'recibida' },
  { id: 'OC-004', proveedor: 'Distribuidora Pharmalife', fecha: '2026-05-10', items: 3, total: 4500.00, estado: 'pendiente' },
  { id: 'OC-005', proveedor: 'Droguería Perú SAC', fecha: '2026-05-08', items: 6, total: 9800.00, estado: 'recibida' },
]

const ESTADOS_OC = {
  pendiente: { etiqueta: 'Pendiente', color: 'amarillo' },
  aprobada: { etiqueta: 'Aprobada', color: 'azul' },
  enviada: { etiqueta: 'Enviada', color: 'azul' },
  recibida: { etiqueta: 'Recibida', color: 'verde' },
  cancelada: { etiqueta: 'Cancelada', color: 'gris' },
}

export default function PaginaOrdenesCompra() {
  const [ordenes] = useState(ordenesMock)

  const pendientes = ordenes.filter(o => o.estado === 'pendiente').length
  const aprobadas = ordenes.filter(o => o.estado === 'aprobada').length
  const recibidas = ordenes.filter(o => o.estado === 'recibida').length

  const columnas = [
    { campo: 'id', encabezado: 'OC', render: (r) => <span className="font-mono text-cuerpo font-medium">{r.id}</span> },
    { campo: 'proveedor', encabezado: 'Proveedor' },
    { campo: 'fecha', encabezado: 'Fecha' },
    { campo: 'items', encabezado: 'Items' },
    { campo: 'total', encabezado: 'Total', render: (r) => <span className="font-semibold">S/ {r.total.toFixed(2)}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const info = ESTADOS_OC[r.estado] || ESTADOS_OC.pendiente
      return <Insignia color={info.color}>{info.etiqueta}</Insignia>
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Órdenes de Compra</h1>
          <p className="text-secundario mt-1">Gestión de órdenes de compra a proveedores</p>
        </div>
        <Boton variante="primario" icono={Plus}>Nueva orden de compra</Boton>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Pendientes" valor={pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="Aprobadas" valor={aprobadas} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="Recibidas" valor={recibidas} icono={CheckCircle} />
      </div>
      <Tabla columnas={columnas} datos={ordenes} />
    </div>
  )
}
