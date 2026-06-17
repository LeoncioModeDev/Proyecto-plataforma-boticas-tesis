import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, CheckCircle, Clock, ArrowRight, X, XCircle, AlertTriangle, CalendarDays, AlertCircle } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { ESTADOS_TRANSFERENCIA, ETIQUETAS_TRANSFERENCIA, COLORES_TRANSFERENCIA } from '@/constants/transferencias'
import { obtenerTransferencias, enviarTransferencia, cancelarTransferencia } from '@/services/supabase/transferencias'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const ICONOS_ESTADO = {
  [ESTADOS_TRANSFERENCIA.CREADA]: Clock,
  [ESTADOS_TRANSFERENCIA.EN_TRANSITO]: Truck,
  [ESTADOS_TRANSFERENCIA.RECIBIDA]: CheckCircle,
  [ESTADOS_TRANSFERENCIA.CANCELADA]: XCircle,
  [ESTADOS_TRANSFERENCIA.RECHAZADA]: AlertTriangle,
}

const MAPEO_COLORES = {
  amarillo: 'amarillo',
  azul: 'azul',
  verde: 'verde',
  rojo: 'rojo',
  naranja: 'naranja',
}

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  { valor: ESTADOS_TRANSFERENCIA.CREADA, etiqueta: ETIQUETAS_TRANSFERENCIA[ESTADOS_TRANSFERENCIA.CREADA] },
  { valor: ESTADOS_TRANSFERENCIA.EN_TRANSITO, etiqueta: ETIQUETAS_TRANSFERENCIA[ESTADOS_TRANSFERENCIA.EN_TRANSITO] },
  { valor: ESTADOS_TRANSFERENCIA.RECIBIDA, etiqueta: ETIQUETAS_TRANSFERENCIA[ESTADOS_TRANSFERENCIA.RECIBIDA] },
  { valor: ESTADOS_TRANSFERENCIA.CANCELADA, etiqueta: ETIQUETAS_TRANSFERENCIA[ESTADOS_TRANSFERENCIA.CANCELADA] },
  { valor: ESTADOS_TRANSFERENCIA.RECHAZADA, etiqueta: ETIQUETAS_TRANSFERENCIA[ESTADOS_TRANSFERENCIA.RECHAZADA] },
]

export default function PaginaTransferencias() {
  const navegar = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [transferencias, setTransferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [fefoModal, setFefoModal] = useState(null)
  const [accionModal, setAccionModal] = useState(null)

  useEffect(() => {
    cargarTransferencias()
  }, [])

  async function cargarTransferencias() {
    try {
      setCargando(true)
      const data = await obtenerTransferencias()
      setTransferencias(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const datos = useMemo(() => transferencias.map(enriquecerTransferencia), [transferencias])

  const filtradas = filtroEstado
    ? datos.filter(t => t.estado === filtroEstado)
    : datos

  function enriquecerTransferencia(t) {
    const productosList = t.items.map(item => ({
      ...item,
      productoNombre: item.producto?.nombreComercial || item.productoId,
    }))

    const lotesInfo = t.items.map(item => ({
      ...item,
      productoNombre: item.producto?.nombreComercial || item.productoId,
      numeroLote: item.lote?.numeroLote || item.loteId,
      fechaVencimiento: item.lote?.fechaVencimiento || null,
    })).sort((a, b) => {
      if (!a.fechaVencimiento) return 1
      if (!b.fechaVencimiento) return -1
      return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
    })

    const cantidadTotal = t.items.reduce((sum, i) => sum + i.cantidad, 0)

    return {
      ...t,
      productosList,
      lotesInfo,
      cantidadTotal,
      origenNombre: t.origen?.nombre || (t.origenTipo === 'drogueria' ? 'Droguería Central' : t.origenId),
      destinoNombre: t.destino?.nombre || t.destinoId,
    }
  }

  async function handleEnviar(id) {
    try {
      await enviarTransferencia(id)
      await cargarTransferencias()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCancelar(id) {
    try {
      await cancelarTransferencia(id, accionModal?.motivo || '')
      setAccionModal(null)
      await cargarTransferencias()
    } catch (e) {
      setError(e.message)
    }
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
        const Icono = ICONOS_ESTADO[r.estado] || Clock
        const color = MAPEO_COLORES[COLORES_TRANSFERENCIA[r.estado]] || 'gris'
        return (
          <Insignia color={color}>
            <Icono className="h-3 w-3 mr-1" />
            {ETIQUETAS_TRANSFERENCIA[r.estado] || r.estado}
          </Insignia>
        )
      },
    },
    {
      campo: 'acciones',
      encabezado: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.estado === ESTADOS_TRANSFERENCIA.CREADA && (
            <>
              <Boton variante="icono" icono={ArrowRight} className="text-marca-principal hover:bg-marca-claro" onClick={() => handleEnviar(r.id)} title="Enviar" />
              <Boton variante="icono" icono={X} className="text-estado-critico hover:bg-rojo-claro" onClick={() => setAccionModal({ tipo: 'cancelar', id: r.id })} title="Cancelar" />
            </>
          )}
        </div>
      ),
    },
  ]

  const estadisticas = {
    total: datos.length,
    creadas: datos.filter(t => t.estado === ESTADOS_TRANSFERENCIA.CREADA).length,
    enTransito: datos.filter(t => t.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO).length,
    recibidas: datos.filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECIBIDA).length,
    canceladas: datos.filter(t => t.estado === ESTADOS_TRANSFERENCIA.CANCELADA).length,
    rechazadas: datos.filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECHAZADA).length,
  }

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando transferencias...</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-principal">Transferencias</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/distribucion/transferencias/nueva')}>
          Nueva Transferencia
        </Boton>
      </div>
      <p className="text-secundario">Gestión integral de transferencias desde Droguería Central a boticas — incluye trazabilidad FEFO, recepción y estados operativos</p>

      {error && (
        <div className="flex items-start gap-3 p-4 text-sm text-estado-critico bg-rojo-claro border border-red-200 rounded-lg shadow-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1 whitespace-pre-wrap">{error}</div>
          <button onClick={() => setError(null)} className="shrink-0 text-estado-critico/60 hover:text-estado-critico transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={estadisticas.total} icono={Truck} />
        <TarjetaMetrica etiqueta="Creadas" valor={estadisticas.creadas} icono={Clock} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={estadisticas.enTransito} icono={ArrowRight} />
        <TarjetaMetrica etiqueta="Recibidas" valor={estadisticas.recibidas} icono={CheckCircle} />
        <TarjetaMetrica etiqueta="Rechazadas" valor={estadisticas.rechazadas} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Canceladas" valor={estadisticas.canceladas} icono={XCircle} />
      </div>

      <div className="flex gap-4">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          {OPCIONES_ESTADO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
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
              <Insignia color={MAPEO_COLORES[COLORES_TRANSFERENCIA[fefoModal.estado]] || 'gris'}>
                {ETIQUETAS_TRANSFERENCIA[fefoModal.estado] || fefoModal.estado}
              </Insignia>
            </div>

            <div className="bg-estado-info-fondo rounded-md p-3">
              <p className="text-xs text-secundario mb-2 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Criterio FEFO aplicado
              </p>
              <p className="text-sm text-principal mb-3">Lotes ordenados por fecha de vencimiento (FIFO) — se priorizan los lotes más próximos a vencer para reducir riesgo de merma.</p>
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

      <Modal abierto={accionModal?.tipo === 'cancelar'} alCerrar={() => setAccionModal(null)} titulo="Cancelar Transferencia" tamano="sm">
        <div className="space-y-4">
          <p className="text-sm text-principal">¿Estás seguro de cancelar esta transferencia? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Boton variante="secundario" onClick={() => setAccionModal(null)}>Volver</Boton>
            <Boton variante="peligro" onClick={() => handleCancelar(accionModal.id)}>Cancelar Transferencia</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
