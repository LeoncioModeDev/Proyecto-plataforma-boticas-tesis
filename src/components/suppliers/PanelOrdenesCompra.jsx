import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Clock, CheckCircle, XCircle, Ban, Truck, Eye, ThumbsUp, ThumbsDown } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Modal from '@/components/common/Modal'
import ModalConfirmar from '@/components/common/ModalConfirmar'
import Alerta from '@/components/common/Alerta'
import { ESTADOS_OC, aprobarOrden, marcarPorRecibir, rechazarOrden, cancelarOrden } from '@/services/supabase/ordenesCompra'
import { formatearFechaCorta } from '@/utilities/formatearFecha'
import useAutenticacion from '@/state/useAutenticacion'

export default function PanelOrdenesCompra({ ordenes, onNueva, onActualizar, esAdmin, rutaBase }) {
  const navegar = useNavigate()
  useAutenticacion()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [detalleOC, setDetalleOC] = useState(null)
  const [confirmarAccion, setConfirmarAccion] = useState(null)
  const [error, setError] = useState('')

  const filtradas = useMemo(() => {
    let r = [...ordenes]
    if (filtroEstado) r = r.filter(o => o.estado === filtroEstado)
    if (filtroProveedor) r = r.filter(o => o.proveedorId === filtroProveedor)
    if (busqueda) {
      const term = busqueda.toLowerCase()
      r = r.filter(o =>
        o.id.toLowerCase().includes(term) ||
        (o.proveedorNombre || '').toLowerCase().includes(term)
      )
    }
    return r
  }, [ordenes, filtroEstado, filtroProveedor, busqueda])

  const proveedoresUnicos = useMemo(() => {
    const mapa = {}
    ordenes.forEach(o => { mapa[o.proveedorId] = o.proveedorNombre })
    return Object.entries(mapa).map(([id, nombre]) => ({ valor: id, etiqueta: nombre })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
  }, [ordenes])

  const ejecutarAccion = async (id, accion, motivo) => {
    setError('')
    try {
      let resultado
      if (accion === 'aprobar') resultado = await aprobarOrden(id)
      if (accion === 'rechazar') resultado = await rechazarOrden(id, motivo)
      if (accion === 'cancelar') resultado = await cancelarOrden(id, motivo)
      if (accion === 'marcar-por-recibir') resultado = await marcarPorRecibir(id)

      if (resultado?.exito && onActualizar) {
        await onActualizar()
      }
    } catch (e) {
      setError(e.message)
    }
    setConfirmarAccion(null)
  }

  const estadisticas = {
    pendientes: ordenes.filter(o => o.estado === 'pendiente').length,
    aprobadas: ordenes.filter(o => o.estado === 'aprobada').length,
    recibidas: ordenes.filter(o => ['recibida', 'recibida_parcial', 'recibida_con_observacion'].includes(o.estado)).length,
    rechazadas: ordenes.filter(o => o.estado === 'rechazada').length,
  }

  const puedeRecibir = (estado) => ['por_recibir', 'recibida_parcial'].includes(estado)
  const puedeMarcarPorRecibir = (estado) => estado === 'aprobada'

  const columnas = [
    { campo: 'numeroOrden', encabezado: 'N.º de Orden', render: (r) => <span className="font-mono text-xs font-medium text-principal">{r.numeroOrden}</span> },
    { campo: 'proveedorNombre', encabezado: 'Proveedor', render: (r) => <span className="text-principal">{r.proveedorNombre}</span> },
    { campo: 'createdAt', encabezado: 'Creación', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
    {
      campo: 'estado', encabezado: 'Estado', render: (r) => {
        const cfg = ESTADOS_OC[r.estado] || ESTADOS_OC.pendiente
        return <Insignia color={cfg.color}>{cfg.etiqueta}</Insignia>
      },
    },
    {
      campo: 'cantidadProductos', encabezado: 'Productos', render: (r) => <span>{(r.items || []).length}</span>,
    },
    {
      campo: 'cantidades', encabezado: 'Cantidades', render: (r) => {
        const solicitada = (r.items || []).reduce((s, i) => s + (i.cantidad || 0), 0)
        const recibida = (r.items || []).reduce((s, i) => s + (i.cantidadRecibida || 0), 0)
        const pendiente = (r.items || []).reduce((s, i) => s + (i.cantidadPendiente ?? Math.max((i.cantidad || 0) - (i.cantidadRecibida || 0), 0)), 0)
        return (
          <div className="text-xs leading-5">
            <div><span className="text-secundario">Solicitada:</span> <span className="font-medium text-principal">{solicitada}</span></div>
            <div><span className="text-secundario">Recibida:</span> <span className="font-medium text-principal">{recibida}</span></div>
            <div><span className="text-secundario">Pendiente:</span> <span className={pendiente > 0 ? 'font-medium text-estado-advertencia' : 'font-medium text-estado-exito'}>{pendiente}</span></div>
          </div>
        )
      },
    },
    {
      campo: 'totalEstimado', encabezado: 'Total Est.', render: (r) => {
        const total = (r.items || []).reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
        return <span className="font-semibold">S/ {total.toFixed(2)}</span>
      },
    },
    {
      campo: 'fechaEstimadaEntrega', encabezado: 'Entrega Est.', render: (r) => (
        <span className="text-etiqueta text-secundario">{r.fechaEstimadaEntrega || '-'}</span>
      ),
    },
    {
      campo: 'acciones', encabezado: '',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Eye} onClick={() => setDetalleOC(r)} title="Ver detalle" className="text-secundario hover:bg-fondo" />
          {esAdmin && r.estado === 'pendiente' && (
            <>
              <Boton variante="icono" icono={ThumbsUp} onClick={() => setConfirmarAccion({ id: r.id, accion: 'aprobar' })} title="Aprobar" className="text-marca-principal hover:bg-marca-claro" />
              <Boton variante="icono" icono={ThumbsDown} onClick={() => setConfirmarAccion({ id: r.id, accion: 'rechazar', requiereMotivo: true })} title="Rechazar" className="text-estado-critico hover:bg-rojo-claro" />
            </>
          )}
          {!esAdmin && r.estado === 'pendiente' && (
            <span className="text-xs text-secundario italic px-2 self-center">Pendiente de aprobación por administrador</span>
          )}
          {(r.estado === 'aprobada' || r.estado === 'por_recibir') && (
            <Boton variante="icono" icono={Ban} onClick={() => setConfirmarAccion({ id: r.id, accion: 'cancelar', requiereMotivo: true })} title="Cancelar" className="text-secundario hover:bg-fondo" />
          )}
          {puedeMarcarPorRecibir(r.estado) && (
            <Boton variante="icono" icono={Truck} onClick={() => setConfirmarAccion({ id: r.id, accion: 'marcar-por-recibir' })} title="Marcar como por recibir" className="text-marca-principal hover:bg-marca-claro" />
          )}
          {puedeRecibir(r.estado) && (
            <Boton variante="icono" icono={ClipboardList} onClick={() => navegar(`${rutaBase}/${r.id}/recibir`)} title="Registrar recepción" className="text-marca-principal hover:bg-marca-claro" />
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Órdenes de Compra</h1>
          <p className="text-secundario mt-1">Gestión de órdenes de compra a proveedores</p>
        </div>
        <Boton variante="primario" icono={ClipboardList} onClick={onNueva}>
          Nueva orden de compra
        </Boton>
      </div>

      {error && <Alerta tipo="error" titulo="Error" mensaje={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Pendientes" valor={estadisticas.pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="Aprobadas" valor={estadisticas.aprobadas} icono={CheckCircle} />
        <TarjetaMetrica etiqueta="Recibidas" valor={estadisticas.recibidas} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="Rechazadas" valor={estadisticas.rechazadas} icono={XCircle} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por OC o proveedor..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_OC).map(([key, val]) => (
            <option key={key} value={key}>{val.etiqueta}</option>
          ))}
        </select>
        <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario">
          <option value="">Todos los proveedores</option>
          {proveedoresUnicos.map(p => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtradas} />

      {/* Modal detalle */}
      <Modal abierto={!!detalleOC} alCerrar={() => setDetalleOC(null)} titulo={`Orden de Compra ${detalleOC?.id?.slice(0, 8)}`} tamano="lg">
        {detalleOC && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Proveedor</p>
                <p className="text-sm font-medium text-principal">{detalleOC.proveedorNombre}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Estado</p>
                <Insignia color={(ESTADOS_OC[detalleOC.estado] || ESTADOS_OC.pendiente).color}>
                  {(ESTADOS_OC[detalleOC.estado] || ESTADOS_OC.pendiente).etiqueta}
                </Insignia>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Fecha estimada entrega</p>
                <p className="text-sm text-principal">{detalleOC.fechaEstimadaEntrega || '-'}</p>
              </div>
              {detalleOC.fechaRealEntrega && (
                <div className="p-3 bg-fondo rounded-md">
                  <p className="text-xs text-secundario mb-1">Fecha real entrega</p>
                  <p className="text-sm text-principal">{detalleOC.fechaRealEntrega}</p>
                </div>
              )}
            </div>

            {detalleOC.observaciones && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Observaciones</p>
                <p className="text-sm text-principal">{detalleOC.observaciones}</p>
              </div>
            )}

            {['aprobada', 'por_recibir', 'recibida', 'recibida_parcial', 'recibida_con_observacion', 'en_devolucion'].includes(detalleOC.estado) && detalleOC.aprobadoPor && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Aprobado por</p>
                <p className="text-sm text-principal">{detalleOC.aprobadoPor} — {formatearFechaCorta(detalleOC.fechaAprobacion)}</p>
              </div>
            )}
            {detalleOC.estado === 'rechazada' && detalleOC.rechazadoPor && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Rechazado por</p>
                <p className="text-sm text-principal">{detalleOC.rechazadoPor} — {formatearFechaCorta(detalleOC.fechaRechazo)}</p>
                {detalleOC.motivoRechazo && <p className="text-sm text-principal mt-1">{detalleOC.motivoRechazo}</p>}
              </div>
            )}
            {detalleOC.estado === 'cancelada' && detalleOC.canceladoPor && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Cancelado por</p>
                <p className="text-sm text-principal">{detalleOC.canceladoPor} — {formatearFechaCorta(detalleOC.fechaCancelacion)}</p>
                {detalleOC.motivoCancelacion && <p className="text-sm text-principal mt-1">{detalleOC.motivoCancelacion}</p>}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-principal mb-2">Productos ({(detalleOC.items || []).length})</p>
              <div className="border border-estilo rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-fondo">
                    <tr className="text-left text-secundario">
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">P. Unitario</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-estilo">
                    {(detalleOC.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-principal">{item.productoNombre}</td>
                        <td className="px-3 py-2 text-right">
                          <div>{item.cantidad}</div>
                          <div className="text-xs text-secundario">Rec. {item.cantidadRecibida || 0} · Pend. {item.cantidadPendiente ?? Math.max((item.cantidad || 0) - (item.cantidadRecibida || 0), 0)}</div>
                        </td>
                        <td className="px-3 py-2 text-right">S/ {item.precioUnitario.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">S/ {(item.cantidad * item.precioUnitario).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {(detalleOC.recepciones || []).length > 0 && (
              <div>
                <p className="text-sm font-medium text-principal mb-2">Recepciones ({(detalleOC.recepciones || []).length})</p>
                <div className="space-y-2">
                  {(detalleOC.recepciones || []).map((rec, idx) => (
                    <div key={rec.id} className="p-3 bg-fondo rounded-md border border-estilo">
                      <p className="text-xs text-secundario">
                        Recepción #{idx + 1} — {formatearFechaCorta(rec.fechaRecepcion)}
                      </p>
                      {rec.observacion && <p className="text-sm text-principal mt-1">{rec.observacion}</p>}
                      <div className="mt-2 text-sm">
                        {(rec.items || []).map((ri, riIdx) => (
                          <p key={riIdx} className="text-secundario">
                            {ri.productoNombre}: recibido {ri.cantidadRecibida}
                            {ri.cantidadDevuelta > 0 ? ` (devuelto ${ri.cantidadDevuelta})` : ''}
                            {ri.numeroLote ? ` — Lote: ${ri.numeroLote}` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {puedeMarcarPorRecibir(detalleOC.estado) && (
                <Boton variante="secundario" icono={Truck} onClick={() => { setDetalleOC(null); setConfirmarAccion({ id: detalleOC.id, accion: 'marcar-por-recibir' }) }}>
                  Marcar como por recibir
                </Boton>
              )}
              {puedeRecibir(detalleOC.estado) && (
                <Boton variante="primario" icono={ClipboardList} onClick={() => navegar(`${rutaBase}/${detalleOC.id}/recibir`)}>
                  Registrar recepción
                </Boton>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmación */}
      <ModalConfirmar
        abierto={!!confirmarAccion}
        alCerrar={() => setConfirmarAccion(null)}
        alConfirmar={(motivo) => ejecutarAccion(confirmarAccion.id, confirmarAccion.accion, motivo)}
        titulo={
          confirmarAccion?.accion === 'aprobar' ? 'Aprobar Orden de Compra' :
          confirmarAccion?.accion === 'rechazar' ? 'Rechazar Orden de Compra' :
          confirmarAccion?.accion === 'marcar-por-recibir' ? 'Marcar como por recibir' :
          'Cancelar Orden de Compra'
        }
        mensaje={
          confirmarAccion?.accion === 'aprobar' ? '¿Estás seguro de aprobar esta orden?' :
          confirmarAccion?.accion === 'rechazar' ? '¿Estás seguro de rechazar esta orden?' :
          confirmarAccion?.accion === 'marcar-por-recibir' ? '¿Estás seguro de marcar esta orden como por recibir? Se incrementará el stock por recibir.' :
          `¿Estás seguro de cancelar esta orden?`
        }
        requiereMotivo={confirmarAccion?.requiereMotivo}
        etiquetaBoton="Confirmar"
      />
    </div>
  )
}
