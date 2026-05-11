import { useState } from 'react'
import { Plus, Truck, MapPin, Clock, CheckCircle, Users } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const ESTADOS_DESPACHO = {
  programando: { etiqueta: 'Programado', color: 'azul', icono: Clock },
  en_ruta: { etiqueta: 'En Ruta', color: 'amarillo', icono: Truck },
  entregado: { etiqueta: 'Entregado', color: 'verde', icono: CheckCircle },
}

const DESPACHOS_MOCK = [
  { id: 'desp-001', transferenciaId: 'tr-003', origenId: 'ub-001', destinoId: 'ub-002', fechaProgramada: '2026-05-05', horaSalida: '08:00', repartidor: 'Juan Pérez', estado: 'en_ruta', items: 2 },
  { id: 'desp-002', transferenciaId: 'tr-004', origenId: 'ub-001', destinoId: 'ub-003', fechaProgramada: '2026-05-06', horaSalida: '09:00', repartidor: 'Carlos López', estado: 'programando', items: 2 },
  { id: 'desp-003', transferenciaId: 'tr-005', origenId: 'ub-001', destinoId: 'ub-002', fechaProgramada: '2026-04-20', horaSalida: '08:30', repartidor: 'Juan Pérez', estado: 'entregado', items: 1 },
]

export default function PaginaDespachos() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [despachos] = useState(DESPACHOS_MOCK)

  const filtrados = filtroEstado
    ? despachos.filter(d => d.estado === filtroEstado)
    : despachos

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-cuerpo">{r.id.toUpperCase()}</span> },
    { campo: 'transferenciaId', encabezado: 'Transferencia', render: (r) => <span className="font-mono text-cuerpo text-marca-principal">{r.transferenciaId.toUpperCase()}</span> },
    { campo: 'destinoId', encabezado: 'Destino', render: (r) => <span className="text-principal">{obtenerNombreUbicacion(r.destinoId)}</span> },
    { campo: 'fechaProgramada', encabezado: 'Fecha', render: (r) => <span className="text-cuerpo">{formatearFechaCorta(r.fechaProgramada)}</span> },
    { campo: 'horaSalida', encabezado: 'Hora', render: (r) => <span className="text-etiqueta text-secundario">{r.horaSalida}</span> },
    { campo: 'repartidor', encabezado: 'Repartidor', render: (r) => <span className="flex items-center gap-1"><Users className="h-3 w-3 text-secundario" />{r.repartidor}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const estado = ESTADOS_DESPACHO[r.estado]
      const Icono = estado.icono
      return <Insignia color={estado.color}><Icono className="h-3 w-3 mr-1" />{estado.etiqueta}</Insignia>
    }},
  ]

  const estadisticas = {
    total: despachos.length,
    programados: despachos.filter(d => d.estado === 'programando').length,
    enRuta: despachos.filter(d => d.estado === 'en_ruta').length,
    entregados: despachos.filter(d => d.estado === 'entregado').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Despachos</h1>
        <Boton variante="primario" icono={Plus} onClick={() => setModalAbierto(true)}>
          Programar Despacho
        </Boton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-marca-claro rounded-lg"><Truck className="h-5 w-5 text-marca-principal" /></div>
            <div><p className="text-2xl font-bold text-principal">{estadisticas.total}</p><p className="text-etiqueta text-secundario">Total</p></div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azul-claro rounded-lg"><Clock className="h-5 w-5 text-azul" /></div>
            <div><p className="text-2xl font-bold text-principal">{estadisticas.programados}</p><p className="text-etiqueta text-secundario">Programados</p></div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amarillo-claro rounded-lg"><MapPin className="h-5 w-5 text-amarillo" /></div>
            <div><p className="text-2xl font-bold text-principal">{estadisticas.enRuta}</p><p className="text-etiqueta text-secundario">En Ruta</p></div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-verde-claro rounded-lg"><CheckCircle className="h-5 w-5 text-estado-exito" /></div>
            <div><p className="text-2xl font-bold text-principal">{estadisticas.entregados}</p><p className="text-etiqueta text-secundario">Entregados</p></div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los estados</option>
          <option value="programando">Programado</option>
          <option value="en_ruta">En Ruta</option>
          <option value="entregado">Entregado</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtrados} />

      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo="Programar Nuevo Despacho">
        <div className="space-y-4">
          <p className="text-cuerpo text-neutro-gris-texto">Los despachos se crean automáticamente cuando se envía una transferencia.</p>
          <div className="flex justify-end">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cerrar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}