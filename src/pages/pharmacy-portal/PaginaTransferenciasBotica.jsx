import { useState, useMemo } from 'react'
import { Truck, PackageCheck, Clock, XCircle, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, CalendarDays } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Boton from '@/components/common/Boton'
import useAutenticacion from '@/state/useAutenticacion'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { lotes as lotesMock } from '@/mock-data/lotes'
import { productos as productosMock } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaCorta, formatearFechaHora } from '@/utilities/formatearFecha'
import { filtrarPorBoticaId } from '@/utilities/permisos'

const CONFIG_ESTADOS = {
  creada: { etiqueta: 'Creada', color: 'amarillo', icono: Clock },
  en_transito: { etiqueta: 'En Tránsito', color: 'azul', icono: Truck },
  recibida: { etiqueta: 'Recibida', color: 'verde', icono: CheckCircle },
  cancelada: { etiqueta: 'Cancelada', color: 'rojo', icono: XCircle },
}

export default function PaginaTransferenciasBotica() {
  const { usuario } = useAutenticacion()
  const [transferencias, setTransferencias] = useState(transferenciasMock)
  const [modalConfirmar, setModalConfirmar] = useState(null)
  const [confirmada, setConfirmada] = useState(false)
  const [expandidas, setExpandidas] = useState({})

  const datos = useMemo(() => {
    return filtrarPorBoticaId(usuario, transferencias, 'destinoId')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => ({
        ...t,
        lotesInfo: t.items.map(item => {
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
        }),
      }))
  }, [usuario, transferencias])

  const toggleExpandir = (id) => {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const confirmarRecepcion = (transferencia) => {
    setTransferencias(prev => prev.map(t =>
      t.id === transferencia.id
        ? { ...t, estado: 'recibida', fechaRecepcion: new Date().toISOString() }
        : t
    ))
    setConfirmada(true)
    setTimeout(() => {
      setModalConfirmar(null)
      setConfirmada(false)
    }, 1500)
  }

  const obtenerNombreProducto = (id) => productosMock.find(p => p.id === id)?.nombreComercial || id
  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

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
      render: (r) => <span className="font-mono text-cuerpo text-marca-principal">{r.id.toUpperCase()}</span>,
    },
    {
      campo: 'tipoTransferencia',
      encabezado: 'Tipo',
      render: (r) => (
        <Insignia color={r.tipoTransferencia === 'redistribucion' ? 'azul' : 'gris'} tamaňo="sm">
          {r.tipoTransferencia === 'redistribucion' ? 'Redist.' : 'Central'}
        </Insignia>
      ),
    },
    {
      campo: 'origenId',
      encabezado: 'Origen',
      render: (r) => (
        <span className="text-principal">{r.origenTipo === 'drogueria' ? 'Droguería Central' : obtenerNombreUbicacion(r.origenId)}</span>
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
        const cfg = CONFIG_ESTADOS[r.estado] || CONFIG_ESTADOS.creada
        const Icono = cfg.icono
        return (
          <Insignia color={cfg.color}>
            <Icono className="h-3 w-3 mr-1" />
            {cfg.etiqueta}
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
        r.estado === 'en_transito' ? (
          <Boton variante="primario" tamano="pequeno" icono={PackageCheck} onClick={() => setModalConfirmar(r)}>
            Confirmar Recepción
          </Boton>
        ) : r.estado === 'recibida' ? (
          <span className="text-xs text-verde flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Recibida
          </span>
        ) : r.estado === 'cancelada' ? (
          <span className="text-xs text-rojo flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Cancelada
          </span>
        ) : (
          <span className="text-xs text-secundario">Pendiente de envío</span>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Transferencias</h1>
        <p className="text-secundario mt-1">Transferencias dirigidas a mi botica — solo puedes confirmar recepción</p>
      </div>

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
                Vas a confirmar la recepción de la transferencia <strong>{modalConfirmar.id.toUpperCase()}</strong>.
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-principal">Productos incluidos:</p>
              {modalConfirmar.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm p-2 bg-fondo rounded">
                  <span className="text-principal">{obtenerNombreProducto(item.productoId)}</span>
                  <span className="font-semibold text-marca-principal">{item.cantidad} uds</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" onClick={() => setModalConfirmar(null)}>Cancelar</Boton>
              <Boton variante="primario" icono={PackageCheck} onClick={() => confirmarRecepcion(modalConfirmar)}>
                Confirmar Recepción
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
    </div>
  )
}
