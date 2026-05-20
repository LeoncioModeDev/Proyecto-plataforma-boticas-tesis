import { useState } from 'react'
import { PackageCheck, Truck, Clock, CheckCircle, Package } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { boticas } from '@/mock-data/boticas'
import { usuarios } from '@/mock-data/usuarios'
import { formatearFechaHora } from '@/utilities/formatearFecha'

const ESTADOS_RECEPCION = {
  pendiente: { etiqueta: 'Por Recibir', color: 'amarillo', icono: Clock },
  recibido: { etiqueta: 'Recibido', color: 'verde', icono: PackageCheck },
}

export default function PaginaRecepciones() {
  const [filtroEstado, setFiltroEstado] = useState('')

  const recepciones = transferenciasMock
    .filter(t => t.estado === 'en_transito' || t.estado === 'recibida')
    .map(t => ({
      ...t,
      estadoRecepcion: t.estado === 'recibido' ? 'recibido' : 'pendiente',
      fechaRecepcionReal: t.fechaRecepcion || null,
    }))

  const filtradas = filtroEstado
    ? recepciones.filter(r => r.estadoRecepcion === filtroEstado)
    : recepciones

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id
  const obtenerNombreUsuario = (id) => usuarios.find(u => u.id === id)?.nombre || id

  const columnas = [
    { campo: 'id', encabezado: 'Transferencia', render: (r) => <span className="font-mono text-cuerpo text-marca-principal">{r.id.toUpperCase()}</span> },
    { campo: 'boticaId', encabezado: 'Destino', render: (r) => <span className="text-principal">{obtenerNombreUbicacion(r.boticaId)}</span> },
    { campo: 'items', encabezado: 'Items', render: (r) => <span className="flex items-center gap-1"><Package className="h-4 w-4 text-secundario" />{r.items.length}</span> },
    { campo: 'fechaDespacho', encabezado: 'Enviado', render: (r) => <span className="text-etiqueta text-secundario">{r.fechaDespacho ? formatearFechaHora(r.fechaDespacho) : '-'}</span> },
    { campo: 'fechaRecepcionReal', encabezado: 'Recibido', render: (r) => <span className="text-etiqueta text-secundario">{r.fechaRecepcionReal ? formatearFechaHora(r.fechaRecepcionReal) : '-'}</span> },
    { campo: 'creadoPor', encabezado: 'Responsable', render: (r) => <span className="text-etiqueta text-secundario">{obtenerNombreUsuario(r.creadoPor)}</span> },
    { campo: 'estadoRecepcion', encabezado: 'Estado', render: (r) => {
      const estado = ESTADOS_RECEPCION[r.estadoRecepcion]
      const Icono = estado.icono
      return <Insignia color={estado.color}><Icono className="h-3 w-3 mr-1" />{estado.etiqueta}</Insignia>
    }},
  ]

  const estadisticas = {
    total: recepciones.length,
    pendientes: recepciones.filter(r => r.estadoRecepcion === 'pendiente').length,
    recibidos: recepciones.filter(r => r.estadoRecepcion === 'recibido').length,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Recepciones</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={estadisticas.total} icono={Truck} />
        <TarjetaMetrica etiqueta="Por Recibir" valor={estadisticas.pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="Recibidos" valor={estadisticas.recibidos} icono={CheckCircle} />
      </div>

      <div className="flex gap-4">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los estados</option>
          <option value="pendiente">Por Recibir</option>
          <option value="recibido">Recibido</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtradas} />
    </div>
  )
}