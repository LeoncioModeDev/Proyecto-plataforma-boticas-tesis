import { useState, useEffect, useMemo } from 'react'
import { PackageCheck, Clock, XCircle, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, CalendarDays, X } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Boton from '@/components/common/Boton'
import { ESTADOS_TRANSFERENCIA, ETIQUETAS_TRANSFERENCIA, COLORES_TRANSFERENCIA, ICONOS_ESTADO_TRANSFERENCIA } from '@/constants/transferencias'
import { obtenerTransferencias, recibirTransferencia, rechazarTransferencia } from '@/services/supabase/transferencias'
import { formatearFechaCorta, formatearFechaHora } from '@/utilities/formatearFecha'

const MAPEO_COLORES = {
  amarillo: 'amarillo',
  azul: 'azul',
  verde: 'verde',
  rojo: 'rojo',
  naranja: 'naranja',
  morado: 'morado',
}

export default function PaginaTransferenciasBotica() {
  const [transferencias, setTransferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalConfirmar, setModalConfirmar] = useState(null)
  const [modalRechazar, setModalRechazar] = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [accionando, setAccionando] = useState(false)
  const [confirmada, setConfirmada] = useState(false)
  const [rechazada, setRechazada] = useState(false)
  const [expandidas, setExpandidas] = useState({})

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

  const datos = useMemo(() => {
    return transferencias
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => ({
        ...t,
        lotesInfo: t.items.map(item => ({
          ...item,
          productoNombre: item.producto?.nombreComercial || item.productoId,
          numeroLote: item.lote?.numeroLote || item.loteId,
          fechaVencimiento: item.lote?.fechaVencimiento || null,
        })).sort((a, b) => {
          if (!a.fechaVencimiento) return 1
          if (!b.fechaVencimiento) return -1
          return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
        }),
      }))
  }, [transferencias])

  const toggleExpandir = (id) => {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleRecibir(transferencia) {
    setAccionando(true)
    try {
      await recibirTransferencia(transferencia.id)
      setConfirmada(true)
      await cargarTransferencias()
      setTimeout(() => {
        setModalConfirmar(null)
        setConfirmada(false)
      }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setAccionando(false)
    }
  }

  async function handleRechazar(transferencia) {
    if (!motivoRechazo.trim()) return
    setAccionando(true)
    try {
      await rechazarTransferencia(transferencia.id, motivoRechazo)
      setRechazada(true)
      await cargarTransferencias()
      setTimeout(() => {
        setModalRechazar(null)
        setRechazada(false)
        setMotivoRechazo('')
      }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setAccionando(false)
    }
  }

  const columnas = [
    {
      campo: 'expandir',
      encabezado: '',
      render: (r) => (
        <button
          onClick={() => toggleExpandir(r.id)}
          className="p-1 rounded hover:bg-fondo text-secundario"
        >
          {expandidas[r.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ),
    },
    {
      campo: 'id',
      encabezado: 'ID',
      render: (r) => <span className="font-mono text-cuerpo text-marca-principal">{r.id?.slice(0, 8)}</span>,
    },
    {
      campo: 'tipoTransferencia',
      encabezado: 'Tipo',
      render: (r) => (
        <Insignia color={r.tipoTransferencia === 'redistribucion' ? 'azul' : 'gris'} tamano="sm">
          {r.tipoTransferencia === 'redistribucion' ? 'Redist.' : 'Central'}
        </Insignia>
      ),
    },
    {
      campo: 'origenId',
      encabezado: 'Origen',
      render: (r) => (
        <span className="text-principal">{r.origen?.nombre || (r.origenTipo === 'drogueria' ? 'Droguería Central' : r.origenId)}</span>
      ),
    },
    {
      campo: 'items',
      encabezado: 'Productos',
      render: (r) => (
        <span className="text-cuerpo">{r.items.length} producto{r.items.length !== 1 ? 's' : ''}</span>
      ),
    },
    {
      campo: 'estado',
      encabezado: 'Estado',
      render: (r) => {
        const Icono = ICONOS_ESTADO_TRANSFERENCIA[r.estado] || Clock
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
      campo: 'createdAt',
      encabezado: 'Fecha',
      render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span>,
    },
    {
      campo: 'acciones',
      encabezado: '',
      render: (r) => (
        r.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO ? (
          <div className="flex gap-1">
            <Boton variante="primario" tamano="pequeno" icono={PackageCheck} onClick={() => setModalConfirmar(r)}>
              Recibir
            </Boton>
            <Boton variante="secundario" tamano="pequeno" icono={X} onClick={() => { setModalRechazar(r); setMotivoRechazo('') }}>
              Rechazar
            </Boton>
          </div>
        ) : r.estado === ESTADOS_TRANSFERENCIA.RECIBIDA ? (
          <span className="text-xs text-verde flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Recibida
          </span>
        ) : r.estado === ESTADOS_TRANSFERENCIA.PENDIENTE_DEVOLUCION ? (
          <span className="text-xs text-naranja flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Pendiente devolución
          </span>
        ) : r.estado === ESTADOS_TRANSFERENCIA.CANCELADA ? (
          <span className="text-xs text-rojo flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Cancelada
          </span>
        ) : (
          <span className="text-xs text-secundario">Pendiente de envío</span>
        )
      ),
    },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando transferencias...</p></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Transferencias</h1>
        <p className="text-secundario mt-1">Transferencias dirigidas a mi botica — puedes confirmar recepción o rechazar</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-estado-critico bg-rojo-claro rounded-md">{error}</div>
      )}

      <Tabla
        columnas={columnas}
        datos={datos}
        renderFilaExpandida={(r) =>
          expandidas[r.id] ? (
            <div className="p-4 bg-fondo rounded-md mx-2 mb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-principal">Detalle de productos y lotes FEFO</p>
                <span className="text-xs text-secundario">
                  {r.tipoTransferencia === 'redistribucion' ? 'Redistribución entre boticas' : 'Transferencia central'}
                </span>
              </div>
              <div className="space-y-2">
                {r.lotesInfo.map((item) => {
                  const diasVenc = item.fechaVencimiento
                    ? Math.ceil((new Date(item.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                    : null
                  const proximoVencer = diasVenc !== null && diasVenc > 0 && diasVenc <= 30
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-fondo-secundario rounded-md border border-estilo">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-principal truncate">{item.productoNombre}</p>
                        <div className="flex items-center gap-3 text-xs text-secundario mt-0.5">
                          <span className="font-mono">Lote: {item.numeroLote}</span>
                          <span className={proximoVencer ? 'text-estado-critico font-medium flex items-center gap-1' : ''}>
                            <CalendarDays className="h-3 w-3" />
                            Vence: {item.fechaVencimiento ? formatearFechaCorta(item.fechaVencimiento) : '-'}
                            {proximoVencer && ` (${diasVenc}d)`}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-marca-principal ml-4">{item.cantidad} uds</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-secundario">
                <div>
                  <span className="block">Fecha de envío: {r.fechaDespacho ? formatearFechaHora(r.fechaDespacho) : 'No enviado'}</span>
                </div>
                <div>
                  <span className="block">Fecha de recepción: {r.fechaRecepcion ? formatearFechaHora(r.fechaRecepcion) : 'Pendiente'}</span>
                </div>
                {r.motivoRechazo && (
                  <div className="col-span-2">
                    <span className="block text-estado-critico">Motivo de rechazo: {r.motivoRechazo}</span>
                  </div>
                )}
              </div>
              {r.lotesInfo.some(l => {
                const d = l.fechaVencimiento ? Math.ceil((new Date(l.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)) : null
                return d !== null && d > 0 && d <= 30
              }) && (
                <p className="mt-2 text-xs text-estado-critico flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Algunos lotes están próximos a vencer (dentro de 30 días).
                </p>
              )}
            </div>
          ) : null
        }
      />

      <Modal
        abierto={!!modalConfirmar && !confirmada}
        alCerrar={() => { setModalConfirmar(null); setConfirmada(false) }}
        titulo="Confirmar Recepción de Transferencia"
        tamano="sm"
      >
        {modalConfirmar && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-estado-info-fondo rounded-md">
              <AlertTriangle className="h-5 w-5 text-estado-info shrink-0" />
              <p className="text-sm text-principal">
                Vas a confirmar la recepción de la transferencia <strong>{modalConfirmar.id.slice(0, 8)}</strong>.
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-principal">Productos incluidos:</p>
              {modalConfirmar.lotesInfo.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-fondo rounded">
                  <div>
                    <p className="text-principal font-medium">{item.productoNombre}</p>
                    <p className="text-xs text-secundario font-mono">Lote {item.numeroLote}{item.fechaVencimiento ? ` — Vence: ${formatearFechaCorta(item.fechaVencimiento)}` : ''}</p>
                  </div>
                  <span className="font-semibold text-marca-principal">{item.cantidad} uds</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" onClick={() => setModalConfirmar(null)}>Cancelar</Boton>
              <Boton variante="primario" icono={PackageCheck} onClick={() => handleRecibir(modalConfirmar)} cargando={accionando}>
                Confirmar Recepción
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={!!modalRechazar && !rechazada}
        alCerrar={() => { setModalRechazar(null); setRechazada(false); setMotivoRechazo('') }}
        titulo="Rechazar Transferencia"
        tamano="sm"
      >
        {modalRechazar && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-rojo-claro rounded-md">
              <AlertTriangle className="h-5 w-5 text-estado-critico shrink-0" />
              <p className="text-sm text-principal">
                Vas a rechazar la transferencia <strong>{modalRechazar.id.slice(0, 8)}</strong>.
                El stock no se incorporará a la botica destino y quedará pendiente de regularización.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-principal block mb-1">Motivo de rechazo *</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indique el motivo del rechazo..."
                rows={3}
                className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" onClick={() => { setModalRechazar(null); setMotivoRechazo('') }}>Volver</Boton>
              <Boton variante="peligro" icono={X} onClick={() => handleRechazar(modalRechazar)} disabled={!motivoRechazo.trim()} cargando={accionando}>
                Rechazar Transferencia
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={confirmada}
        alCerrar={() => { setModalConfirmar(null); setConfirmada(false) }}
        titulo="Recepción Confirmada"
        tamano="sm"
      >
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle className="h-12 w-12 text-marca-principal mb-3" />
          <p className="text-principal font-medium">Transferencia recibida exitosamente</p>
          <p className="text-secundario text-sm mt-1">El stock de tu botica ha sido actualizado.</p>
        </div>
      </Modal>

      <Modal
        abierto={rechazada}
        alCerrar={() => { setModalRechazar(null); setRechazada(false); setMotivoRechazo('') }}
        titulo="Transferencia Rechazada"
        tamano="sm"
      >
        <div className="flex flex-col items-center py-4 text-center">
          <AlertTriangle className="h-12 w-12 text-naranja mb-3" />
          <p className="text-principal font-medium">Transferencia rechazada</p>
          <p className="text-secundario text-sm mt-1">La transferencia fue rechazada. El stock no se incorporó a la botica destino y queda pendiente de regularización.</p>
        </div>
      </Modal>
    </div>
  )
}
