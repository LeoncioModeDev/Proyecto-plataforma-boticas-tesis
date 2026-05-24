import { useState } from 'react'
import { FileText, Truck, PackageCheck, XCircle } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const ESTADOS = {
  creada: { etiqueta: 'Creada', color: 'amarillo' },
  en_transito: { etiqueta: 'En Tránsito', color: 'azul' },
  recibida: { etiqueta: 'Recibida', color: 'verde' },
}

export default function PaginaHistorialDistribucion() {
  const [filtroAnio, setFiltroAnio] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const historial = [...transferenciasMock].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  let filtrado = [...historial]
  if (filtroAnio) filtrado = filtrado.filter(t => t.createdAt.startsWith(filtroAnio))
  if (busqueda) {
    const term = busqueda.toLowerCase()
    filtrado = filtrado.filter(t => 
      t.id.toLowerCase().includes(term) ||
      obtenerNombreUbicacion(t.destinoId).toLowerCase().includes(term)
    )
  }

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

  const getDuracion = (creacion, recepcion) => {
    if (!recepcion) return '-'
    const dias = Math.ceil((new Date(recepcion) - new Date(creacion)) / (1000 * 60 * 60 * 24))
    return `${dias} día${dias !== 1 ? 's' : ''}`
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-cuerpo">{r.id.toUpperCase()}</span> },
    { campo: 'destinoId', encabezado: 'Destino', render: (r) => <span className="text-principal">{obtenerNombreUbicacion(r.destinoId)}</span> },
    { campo: 'items', encabezado: 'Productos', render: (r) => <span>{r.items.reduce((a, i) => a + i.cantidad, 0)}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const estadoInfo = ESTADOS[r.estado] || ESTADOS.creada
      return <Insignia color={estadoInfo.color}>{estadoInfo.etiqueta}</Insignia>
    }},
    { campo: 'createdAt', encabezado: 'Creación', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
    { campo: 'fechaRecepcion', encabezado: 'Recepción', render: (r) => <span className="text-etiqueta text-secundario">{r.fechaRecepcion ? formatearFechaCorta(r.fechaRecepcion) : '-'}</span> },
    { campo: 'duracion', encabezado: 'Duración', render: (r) => <span className="text-etiqueta text-secundario">{getDuracion(r.createdAt, r.fechaRecepcion)}</span> },
  ]

  const anios = [...new Set(historial.map(t => t.createdAt.substring(0, 4)))].sort().reverse()

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Historial de Distribución</h1>

      <div className="flex gap-4 flex-wrap">
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar por ID o destino..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton flex-1 min-w-[200px]"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={historial.length} icono={FileText} />
        <TarjetaMetrica etiqueta="Recibidas" valor={historial.filter(t => t.estado === 'recibida').length} icono={PackageCheck} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={historial.filter(t => t.estado === 'en_transito').length} icono={Truck} />
        <TarjetaMetrica etiqueta="Creadas" valor={historial.filter(t => t.estado === 'creada').length} icono={XCircle} />
      </div>

      <Tabla columnas={columnas} datos={filtrado} />
    </div>
  )
}