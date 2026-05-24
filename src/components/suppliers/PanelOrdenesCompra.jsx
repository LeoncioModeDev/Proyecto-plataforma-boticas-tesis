import { useState, useMemo } from 'react'
import { ClipboardList, Clock, CheckCircle, XCircle, Eye, ThumbsUp, ThumbsDown } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Modal from '@/components/common/Modal'
import { ESTADOS_OC, calcularTotal } from '@/mock-data/ordenesCompra'
import { proveedores } from '@/mock-data/proveedores'
import { formatearFechaCorta } from '@/utilities/formatearFecha'
import useAutenticacion from '@/state/useAutenticacion'

export default function PanelOrdenesCompra({ ordenes, setOrdenes, onNueva, esAdmin }) {
  const { usuario } = useAutenticacion()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [detalleOC, setDetalleOC] = useState(null)

  const filtradas = useMemo(() => {
    let r = [...ordenes]
    if (filtroEstado) r = r.filter(o => o.estado === filtroEstado)
    if (filtroProveedor) r = r.filter(o => o.proveedorId === filtroProveedor)
    if (busqueda) {
      const term = busqueda.toLowerCase()
      r = r.filter(o =>
        o.id.toLowerCase().includes(term) ||
        o.proveedorNombre.toLowerCase().includes(term) ||
        o.creadoPorNombre.toLowerCase().includes(term)
      )
    }
    return r
  }, [ordenes, filtroEstado, filtroProveedor, busqueda])

  const aprobarOC = (id) => {
    setOrdenes(prev => prev.map(o =>
      o.id === id ? { ...o, estado: 'aprobada', aprobadoPor: usuario.id, fechaAprobacion: new Date().toISOString() } : o
    ))
  }

  const rechazarOC = (id) => {
    setOrdenes(prev => prev.map(o =>
      o.id === id ? { ...o, estado: 'rechazada', aprobadoPor: usuario.id, fechaAprobacion: new Date().toISOString() } : o
    ))
  }

  const opcionesProveedor = proveedores
    .filter(p => p.activo)
    .map(p => ({ valor: p.id, etiqueta: p.razonSocial }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))

  const estadisticas = {
    pendientes: ordenes.filter(o => o.estado === 'pendiente').length,
    aprobadas: ordenes.filter(o => o.estado === 'aprobada').length,
    recibidas: ordenes.filter(o => o.estado === 'recibida').length,
    rechazadas: ordenes.filter(o => o.estado === 'rechazada').length,
  }

  const columnas = [
    { campo: 'id', encabezado: 'OC', render: (r) => <span className="font-mono text-cuerpo font-medium text-marca-principal">{r.id}</span> },
    { campo: 'proveedorNombre', encabezado: 'Proveedor', render: (r) => <span className="text-principal">{r.proveedorNombre}</span> },
    { campo: 'createdAt', encabezado: 'Creación', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
    {
      campo: 'estado', encabezado: 'Estado', render: (r) => {
        const cfg = ESTADOS_OC[r.estado] || ESTADOS_OC.pendiente
        return <Insignia color={cfg.color}>{cfg.etiqueta}</Insignia>
      },
    },
    {
      campo: 'items', encabezado: 'Productos', render: (r) => <span>{r.items.length}</span>,
    },
    {
      campo: 'total', encabezado: 'Total Est.', render: (r) => <span className="font-semibold">S/ {calcularTotal(r.items).toFixed(2)}</span>,
    },
    {
      campo: 'fechaEstimadaEntrega', encabezado: 'Entrega Est.', render: (r) => (
        <span className="text-etiqueta text-secundario">{r.fechaEstimadaEntrega || '-'}</span>
      ),
    },
    { campo: 'creadoPorNombre', encabezado: 'Creado por', render: (r) => <span className="text-etiqueta text-secundario">{r.creadoPorNombre}</span> },
    {
      campo: 'acciones', encabezado: '',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Eye} onClick={() => setDetalleOC(r)} title="Ver detalle" className="text-secundario hover:bg-fondo" />
          {esAdmin && r.estado === 'pendiente' && (
            <>
              <Boton variante="icono" icono={ThumbsUp} onClick={() => aprobarOC(r.id)} title="Aprobar" className="text-marca-principal hover:bg-marca-claro" />
              <Boton variante="icono" icono={ThumbsDown} onClick={() => rechazarOC(r.id)} title="Rechazar" className="text-estado-critico hover:bg-rojo-claro" />
            </>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Pendientes" valor={estadisticas.pendientes} icono={Clock} />
        <TarjetaMetrica etiqueta="Aprobadas" valor={estadisticas.aprobadas} icono={CheckCircle} />
        <TarjetaMetrica etiqueta="Recibidas" valor={estadisticas.recibidas} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="Rechazadas" valor={estadisticas.rechazadas} icono={XCircle} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por OC, proveedor o creador..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
          <option value="recibida">Recibida</option>
        </select>
        <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario">
          <option value="">Todos los proveedores</option>
          {opcionesProveedor.map(p => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtradas} />

      <Modal abierto={!!detalleOC} alCerrar={() => setDetalleOC(null)} titulo={`Orden de Compra ${detalleOC?.id}`} tamano="lg">
        {detalleOC && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                <p className="text-xs text-secundario mb-1">Creado por</p>
                <p className="text-sm text-principal">{detalleOC.creadoPorNombre}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Fecha estimada de entrega</p>
                <p className="text-sm text-principal">{detalleOC.fechaEstimadaEntrega || 'No definida'}</p>
              </div>
            </div>

            {detalleOC.observaciones && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Observaciones</p>
                <p className="text-sm text-principal">{detalleOC.observaciones}</p>
              </div>
            )}

            {detalleOC.aprobadoPor && (
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">
                  {detalleOC.estado === 'aprobada' ? 'Aprobado' : 'Rechazado'} por
                </p>
                <p className="text-sm text-principal">
                  {detalleOC.aprobadoPor} — {formatearFechaCorta(detalleOC.fechaAprobacion)}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-principal mb-2">Productos ({detalleOC.items.length})</p>
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
                    {detalleOC.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-principal">{item.productoNombre}</td>
                        <td className="px-3 py-2 text-right">{item.cantidad}</td>
                        <td className="px-3 py-2 text-right">S/ {item.precioUnitario.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">S/ {(item.cantidad * item.precioUnitario).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-fondo font-medium">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-principal">Total Estimado</td>
                      <td className="px-3 py-2 text-right text-marca-principal">S/ {calcularTotal(detalleOC.items).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
