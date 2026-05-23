import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, CheckCircle, Clock } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

export default function PaginaTransferencias() {
  const navegar = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [transferencias] = useState(transferenciasMock)

  const filtradas = filtroEstado
    ? transferencias.filter(t => t.estado === filtroEstado)
    : transferencias

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

  const pendientes = transferencias.filter(t => t.estado !== 'recibida').length
  const enTransito = transferencias.filter(t => t.estado === 'en_transito').length
  const completadas = transferencias.filter(t => t.estado === 'recibida').length

  const ESTADOS = {
    creada: { etiqueta: 'Creada', color: 'amarillo' },
    en_transito: { etiqueta: 'En Tránsito', color: 'azul' },
    recibida: { etiqueta: 'Recibida', color: 'verde' },
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-cuerpo">{r.id.toUpperCase()}</span> },
    { campo: 'origenId', encabezado: 'Origen', render: (r) => obtenerNombreUbicacion(r.origenId) },
    { campo: 'destinoId', encabezado: 'Destino', render: (r) => obtenerNombreUbicacion(r.destinoId) },
    { campo: 'items', encabezado: 'Items', render: (r) => <span>{r.items.length}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const info = ESTADOS[r.estado] || ESTADOS.creada
      return <Insignia color={info.color}>{info.etiqueta}</Insignia>
    }},
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Transferencias</h1>
          <p className="text-secundario mt-1">Gestión de transferencias entre boticas</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/distribucion/transferencias/nueva')}>Nueva transferencia</Boton>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Pendientes" valor={pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={enTransito} icono={Truck} />
        <TarjetaMetrica etiqueta="Completadas" valor={completadas} icono={CheckCircle} />
      </div>
      <div className="flex gap-4">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los estados</option>
          <option value="creada">Creada</option>
          <option value="en_transito">En Tránsito</option>
          <option value="recibida">Recibida</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtradas} />
    </div>
  )
}
