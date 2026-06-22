import { useState, useEffect, useMemo } from 'react'
import { FileText, PackageCheck, Truck, XCircle, Eye, Ban } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import { listarOrdenes, ESTADOS_OC } from '@/services/supabase/ordenesCompra'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const calcularTotal = (items) => items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0)

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  ...Object.entries(ESTADOS_OC).map(([valor, cfg]) => ({ valor, etiqueta: cfg.etiqueta })),
]

export default function PaginaHistorialOrdenes() {
  const navegar = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [filtroAnio, setFiltroAnio] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [detalleOC, setDetalleOC] = useState(null)

  useEffect(() => {
    setCargando(true)
    setErrorMsg(null)
    listarOrdenes()
      .then(data => setOrdenes(data))
      .catch(err => setErrorMsg(err.message))
      .finally(() => setCargando(false))
  }, [])

  const filtradas = useMemo(() => {
    let r = [...ordenes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (filtroAnio) r = r.filter(o => o.createdAt?.startsWith(filtroAnio))
    if (filtroEstado) r = r.filter(o => o.estado === filtroEstado)
    if (busqueda) {
      const term = busqueda.toLowerCase()
      r = r.filter(o =>
        o.id.toLowerCase().includes(term) ||
        o.proveedorNombre?.toLowerCase().includes(term)
      )
    }
    return r
  }, [ordenes, filtroAnio, filtroEstado, busqueda])

  const anios = useMemo(
    () => [...new Set(ordenes.map(o => o.createdAt?.substring(0, 4)).filter(Boolean))].sort().reverse(),
    [ordenes],
  )

  const columnas = [
    { campo: 'numeroOrden', encabezado: 'N.º de Orden', render: (r) => <span className="font-mono text-xs text-principal">{r.numeroOrden}</span> },
    { campo: 'proveedorNombre', encabezado: 'Proveedor' },
    { campo: 'createdAt', encabezado: 'Creación', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const cfg = ESTADOS_OC[r.estado] || ESTADOS_OC.pendiente
      return <Insignia color={cfg.color}>{cfg.etiqueta}</Insignia>
    }},
    { campo: 'items', encabezado: 'Productos', render: (r) => <span>{r.items?.length || 0}</span> },
    { campo: 'total', encabezado: 'Total', render: (r) => <span className="font-semibold">S/ {calcularTotal(r.items || []).toFixed(2)}</span> },
    { campo: 'acciones', encabezado: '', render: (r) => (
      <Boton variante="icono" icono={Eye} onClick={() => setDetalleOC(r)} title="Ver detalle" className="text-secundario hover:bg-fondo" />
    )},
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando órdenes...</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Historial de Órdenes de Compra</h1>
          <p className="text-secundario mt-1">Trazabilidad completa de todas lasórdenes registradas</p>
        </div>
        <Boton variante="primario" icono={FileText} onClick={() => navegar('/central/proveedores/ordenes/nueva')}>
          Nueva Orden
        </Boton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={ordenes.length} icono={FileText} />
        <TarjetaMetrica etiqueta="Aprobadas" valor={ordenes.filter(o => o.estado === 'aprobada').length} icono={PackageCheck} />
        <TarjetaMetrica etiqueta="Recibidas" valor={ordenes.filter(o => o.estado === 'recibida').length} icono={Truck} />
        <TarjetaMetrica etiqueta="Rechazadas" valor={ordenes.filter(o => o.estado === 'rechazada').length} icono={XCircle} />
        <TarjetaMetrica etiqueta="Canceladas" valor={ordenes.filter(o => o.estado === 'cancelada').length} icono={Ban} />
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
          {OPCIONES_ESTADO.map(op => <option key={op.valor} value={op.valor}>{op.etiqueta}</option>)}
        </select>
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {errorMsg ? (
        <Alerta tipo="error" titulo="Error al cargar" mensaje={errorMsg} />
      ) : (
        <Tabla columnas={columnas} datos={filtradas} />
      )}

      <Modal abierto={!!detalleOC} alCerrar={() => setDetalleOC(null)} titulo={`Orden ${detalleOC?.id}`} tamano="lg">
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
                <p className="text-xs text-secundario mb-1">Entrega estimada</p>
                <p className="text-sm text-principal">{detalleOC.fechaEstimadaEntrega || '-'}</p>
              </div>
              {detalleOC.fechaRealEntrega && (
                <div className="p-3 bg-fondo rounded-md">
                  <p className="text-xs text-secundario mb-1">Entrega real</p>
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
            <div className="border border-estilo rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-fondo">
                  <tr className="text-left text-secundario">
                    <th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">P. Unit.</th><th className="px-3 py-2 text-right">Subtotal</th>
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
                    <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2 text-right text-marca-principal">S/ {calcularTotal(detalleOC.items).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
