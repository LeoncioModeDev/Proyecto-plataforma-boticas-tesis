import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, CheckCircle, Clock, ArrowRight, X, XCircle, CalendarDays } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { lotes as lotesMock } from '@/mock-data/lotes'
import { productos as productosMock } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { usuarios } from '@/mock-data/usuarios'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const ESTADOS = {
  creada: { etiqueta: 'Creada', color: 'amarillo', icono: Clock },
  en_transito: { etiqueta: 'En Tránsito', color: 'azul', icono: Truck },
  recibida: { etiqueta: 'Recibida', color: 'verde', icono: CheckCircle },
  cancelada: { etiqueta: 'Cancelada', color: 'rojo', icono: XCircle },
}

function enriquecerTransferencia(t) {
  const productosList = t.items.map(item => {
    const prod = productosMock.find(p => p.id === item.productoId)
    return { ...item, productoNombre: prod?.nombreComercial || item.productoId }
  })

  const lotesInfo = t.items.map(item => {
    const lote = lotesMock.find(l => l.id === item.loteId)
    return {
      ...item,
      productoNombre: productosMock.find(p => p.id === item.productoId)?.nombreComercial || item.productoId,
      numeroLote: lote?.numeroLote || item.loteId,
      fechaVencimiento: lote?.fechaVencimiento || null,
    }
  }).sort((a, b) => {
    if (!a.fechaVencimiento) return 1
    if (!b.fechaVencimiento) return -1
    return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
  })

  const cantidadTotal = t.items.reduce((sum, i) => sum + i.cantidad, 0)

  const destino = boticas.find(b => b.id === t.destinoId)
  const origen = t.origenTipo === 'drogueria'
    ? 'Droguería Central'
    : boticas.find(b => b.id === t.origenId)?.nombre || t.origenId

  return {
    ...t,
    productosList,
    lotesInfo,
    cantidadTotal,
    origenNombre: origen,
    destinoNombre: destino?.nombre || t.destinoId,
  }
}

export default function PaginaTransferencias() {
  const navegar = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [transferencias, setTransferencias] = useState(transferenciasMock)
  const [fefoModal, setFefoModal] = useState(null)

  const datos = useMemo(() => transferencias.map(enriquecerTransferencia), [transferencias])

  const filtradas = filtroEstado
    ? datos.filter(t => t.estado === filtroEstado)
    : datos

  const obtenerNombreUsuario = (id) => usuarios.find(u => u.id === id)?.nombre || id

  const cambiarEstado = (id, nuevoEstado) => {
    setTransferencias(prev => prev.map(t => {
      if (t.id !== id) return t
      return {
        ...t,
        estado: nuevoEstado,
        fechaDespacho: nuevoEstado === 'en_transito' ? new Date().toISOString() : t.fechaDespacho,
        fechaRecepcion: nuevoEstado === 'recibida' ? new Date().toISOString() : t.fechaRecepcion,
      }
    }))
  }

  const columnas = [
    {
      campo: 'id',
      encabezado: 'ID',
      render: (r) => <span className="font-mono text-cuerpo font-medium text-marca-principal">{r.id.toUpperCase()}</span>,
    },
    {
      campo: 'tipoTransferencia',
      encabezado: 'Tipo',
      render: (r) => (
        <Insignia color={r.tipoTransferencia === 'redistribucion' ? 'azul' : 'gris'}>
          {r.tipoTransferencia === 'redistribucion' ? 'Redistribución' : 'Transferencia'}
        </Insignia>
      ),
    },
    {
      campo: 'origenNombre',
      encabezado: 'Origen',
      render: (r) => <span className="text-principal">{r.origenNombre}</span>,
    },
    {
      campo: 'destinoNombre',
      encabezado: 'Destino',
      render: (r) => <span className="text-principal">{r.destinoNombre}</span>,
    },
    {
      campo: 'productosList',
      encabezado: 'Productos',
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          {r.productosList.map((item, idx) => (
            <span key={idx} className="text-xs text-principal">{item.productoNombre} x{item.cantidad}</span>
          ))}
        </div>
      ),
    },
    {
      campo: 'lotesInfo',
      encabezado: 'Lotes FEFO',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setFefoModal(r) }}
          className="text-marca-principal hover:underline text-sm flex items-center gap-1"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {r.lotesInfo.length} lote{r.lotesInfo.length !== 1 ? 's' : ''}
        </button>
      ),
    },
    {
      campo: 'cantidadTotal',
      encabezado: 'Cant. Total',
      render: (r) => <span className="font-semibold text-marca-principal">{r.cantidadTotal} uds</span>,
    },
    {
      campo: 'createdAt',
      encabezado: 'Creación',
      render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span>,
    },
    {
      campo: 'fechaDespacho',
      encabezado: 'Envío',
      render: (r) => <span className="text-etiqueta text-secundario">{r.fechaDespacho ? formatearFechaCorta(r.fechaDespacho) : '-'}</span>,
    },
    {
      campo: 'fechaRecepcion',
      encabezado: 'Recepción',
      render: (r) => <span className="text-etiqueta text-secundario">{r.fechaRecepcion ? formatearFechaCorta(r.fechaRecepcion) : '-'}</span>,
    },
    {
      campo: 'estado',
      encabezado: 'Estado',
      render: (r) => {
        const estado = ESTADOS[r.estado] || ESTADOS.creada
        const Icono = estado.icono
        return (
          <Insignia color={estado.color}>
            <Icono className="h-3 w-3 mr-1" />
            {estado.etiqueta}
          </Insignia>
        )
      },
    },
    {
      campo: 'creadoPor',
      encabezado: 'Creador',
      render: (r) => <span className="text-etiqueta text-secundario">{obtenerNombreUsuario(r.creadoPor)}</span>,
    },
    {
      campo: 'acciones',
      encabezado: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.estado === 'creada' && (
            <>
              <Boton variante="icono" icono={ArrowRight} className="text-marca-principal hover:bg-marca-claro" onClick={() => cambiarEstado(r.id, 'en_transito')} title="Enviar" />
              <Boton variante="icono" icono={X} className="text-estado-critico hover:bg-rojo-claro" onClick={() => cambiarEstado(r.id, 'cancelada')} title="Cancelar" />
            </>
          )}
        </div>
      ),
    },
  ]

  const pendientes = datos.filter(t => t.estado === 'creada').length
  const enTransito = datos.filter(t => t.estado === 'en_transito').length
  const completadas = datos.filter(t => t.estado === 'recibida').length
  const canceladas = datos.filter(t => t.estado === 'cancelada').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Transferencias</h1>
          <p className="text-secundario mt-1">Gestión integral de transferencias desde Droguería Central a boticas y redistribuciones entre boticas</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/distribucion/transferencias/nueva')}>Nueva transferencia</Boton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Pendientes" valor={pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={enTransito} icono={Truck} />
        <TarjetaMetrica etiqueta="Recibidas" valor={completadas} icono={CheckCircle} />
        <TarjetaMetrica etiqueta="Canceladas" valor={canceladas} icono={XCircle} />
      </div>

      <div className="flex gap-4">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas</option>
          <option value="creada">Creada</option>
          <option value="en_transito">En Tránsito</option>
          <option value="recibida">Recibida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtradas} />

      <Modal abierto={!!fefoModal} alCerrar={() => setFefoModal(null)} titulo={`Lotes FEFO — ${fefoModal?.id?.toUpperCase()}`} tamano="lg">
        {fefoModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-fondo rounded-md">
              <div>
                <p className="text-sm font-medium text-principal">{fefoModal.origenNombre} <ArrowRight className="h-3 w-3 inline mx-1 text-secundario" /> {fefoModal.destinoNombre}</p>
                <p className="text-xs text-secundario">{fefoModal.tipoTransferencia === 'redistribucion' ? 'Redistribución' : 'Transferencia Central'} — {fefoModal.cantidadTotal} unidades</p>
              </div>
              <Insignia color={(ESTADOS[fefoModal.estado] || ESTADOS.creada).color}>
                {(ESTADOS[fefoModal.estado] || ESTADOS.creada).etiqueta}
              </Insignia>
            </div>

            <div className="bg-estado-info-fondo rounded-md p-3">
              <p className="text-xs text-secundario mb-2 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Criterio FEFO aplicado
              </p>
              <p className="text-sm text-principal">Lotes ordenados por fecha de vencimiento (FIFO) — se priorizan los lotes más próximos a vencer para reducir riesgo de merma.</p>
            </div>

            <div className="border border-estilo rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-fondo">
                  <tr className="text-left text-secundario">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-estilo">
                  {fefoModal.lotesInfo.map((lote, idx) => {
                    const diasVenc = Math.ceil((new Date(lote.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                    const proximoVencer = diasVenc > 0 && diasVenc <= 30
                    return (
                      <tr key={idx} className={proximoVencer ? 'bg-rojo-claro/20' : ''}>
                        <td className="px-3 py-2 text-principal">{lote.productoNombre}</td>
                        <td className="px-3 py-2 font-mono text-secundario">{lote.numeroLote}</td>
                        <td className="px-3 py-2">
                          <span className={proximoVencer ? 'text-estado-critico font-medium' : 'text-secundario'}>
                            {lote.fechaVencimiento ? formatearFechaCorta(lote.fechaVencimiento) : '-'}
                            {proximoVencer && ` (${diasVenc}d)`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-principal">{lote.cantidad} uds</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-secundario">* Los lotes resaltados están próximos a vencer (dentro de 30 días) y se priorizan según criterio FEFO.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
