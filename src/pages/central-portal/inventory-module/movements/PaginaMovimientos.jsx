import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO, OPCIONES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'

export default function PaginaMovimientos() {
  const [searchParams] = useSearchParams()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [fechaHoraDesde, setFechaHoraDesde] = useState('')
  const [fechaHoraHasta, setFechaHoraHasta] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    setCargando(true)
    obtenerMovimientos()
      .then(data => {
        setDatos(data)
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [])

  let filtrados = [...datos]
  if (busqueda.trim()) {
    const termino = busqueda.trim().toLowerCase()
    filtrados = filtrados.filter(m => [m.codigoProducto, m.nombreProducto, m.nombreUbicacion, m.motivo, m.nombreUsuario].some(valor => (valor || '').toLowerCase().includes(termino)))
  }
  if (filtroProducto) filtrados = filtrados.filter(m => m.productoId === filtroProducto)
  if (filtroUbicacion) filtrados = filtrados.filter(m => (m.ubicacionId || 'drogueria') === filtroUbicacion)
  if (filtroTipo) filtrados = filtrados.filter(m => m.tipo === filtroTipo)
  const productoId = searchParams.get('productoId')
  const ubicacionId = searchParams.get('ubicacionId')
  if (productoId) filtrados = filtrados.filter(m => m.productoId === productoId)
  if (ubicacionId) filtrados = filtrados.filter(m => m.ubicacionId === ubicacionId)
  if (fechaHoraDesde) filtrados = filtrados.filter(m => new Date(m.createdAt) >= new Date(fechaHoraDesde))
  if (fechaHoraHasta) filtrados = filtrados.filter(m => new Date(m.createdAt) <= new Date(fechaHoraHasta))

  const productosUnicos = [...new Map(datos.map(m => [m.productoId, { valor: m.productoId, etiqueta: m.nombreProducto }])).values()]
  const ubicacionesUnicas = [...new Map(datos.map(m => [m.ubicacionId || 'drogueria', { valor: m.ubicacionId || 'drogueria', etiqueta: m.nombreUbicacion }])).values()]
  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroProducto('')
    setFiltroUbicacion('')
    setFiltroTipo('')
    setFechaHoraDesde('')
    setFechaHoraHasta('')
  }

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'createdAt', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => <span className={r.tipo === 'entrada' || r.tipo === 'ajuste' ? 'text-marca-principal font-semibold' : 'text-estado-critico font-semibold'}>{r.tipo === 'entrada' ? '+' : '-'}{Math.abs(r.cantidad)}</span> },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="block text-etiqueta text-secundario truncate max-w-[220px]">{r.motivo}</span> },
    { campo: 'nombreUsuario', encabezado: 'Usuario' },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando movimientos...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1 text-principal">Kardex - Movimientos de Inventario</h1>
      </div>
      <p className="text-secundario -mt-4">Historial de movimientos generados automáticamente por órdenes de compra, transferencias, ajustes y mermas. Solo consulta.</p>
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar movimiento..." className="w-full sm:w-72" />
        <SelectBusquedaFiltro valor={filtroProducto} alCambiar={setFiltroProducto} opciones={productosUnicos} placeholder="Producto" />
        <SelectFiltro valor={filtroUbicacion} alCambiar={setFiltroUbicacion} opciones={ubicacionesUnicas} placeholder="Todas las ubicaciones" />
        <SelectFiltro valor={filtroTipo} alCambiar={setFiltroTipo} opciones={OPCIONES_MOVIMIENTO} placeholder="Todos los tipos" />
        <label className="flex flex-col gap-1 text-xs text-secundario">
          Fecha/hora inicial
          <input type="datetime-local" value={fechaHoraDesde} onChange={e => setFechaHoraDesde(e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-secundario">
          Fecha/hora final
          <input type="datetime-local" value={fechaHoraHasta} onChange={e => setFechaHoraHasta(e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" />
        </label>
      </BarraFiltros>
      <Tabla columnas={columnas} datos={filtrados} busqueda={false} alClickFila={setDetalle} />
      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de movimiento" tamano="lg">
        {detalle && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><p className="text-etiqueta text-secundario">Producto</p><p className="font-medium text-principal">{detalle.nombreProducto}</p></div>
            <div><p className="text-etiqueta text-secundario">Código</p><p className="font-mono text-principal">{detalle.codigoProducto || '-'}</p></div>
            <div><p className="text-etiqueta text-secundario">Ubicación</p><p className="font-medium text-principal">{detalle.nombreUbicacion}</p></div>
            <div><p className="text-etiqueta text-secundario">Tipo</p><Insignia color={COLORES_MOVIMIENTO[detalle.tipo]}>{ETIQUETAS_MOVIMIENTO[detalle.tipo]}</Insignia></div>
            <div><p className="text-etiqueta text-secundario">Cantidad</p><p className="font-medium text-principal">{detalle.cantidad}</p></div>
            <div><p className="text-etiqueta text-secundario">Fecha/hora</p><p className="font-medium text-principal">{formatearFechaHora(detalle.createdAt)}</p></div>
            <div><p className="text-etiqueta text-secundario">Usuario</p><p className="font-medium text-principal">{detalle.nombreUsuario || '-'}</p></div>
            <div className="sm:col-span-2"><p className="text-etiqueta text-secundario">Motivo</p><p className="font-medium text-principal whitespace-pre-wrap">{detalle.motivo || '-'}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
