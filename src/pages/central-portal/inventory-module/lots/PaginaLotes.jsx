import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import useConfiguracion from '@/state/useConfiguracion'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'

export default function PaginaLotes() {
  const [searchParams] = useSearchParams()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState('')
  const [filtroStock, setFiltroStock] = useState('con_stock')
  const alertaDias = useConfiguracion(s => s.config?.alertaVencimientoDias ?? 30)

  useEffect(() => {
    setCargando(true)
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        setDatos(calcularFEFO(data))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [])

  const datosFiltrados = datos.filter(l => {
    const productoId = searchParams.get('productoId')
    const ubicacionId = searchParams.get('ubicacionId')
    if (productoId && l.productoId !== productoId) return false
    if (ubicacionId && l.ubicacionId !== ubicacionId) return false
    if (busqueda.trim()) {
      const termino = busqueda.trim().toLowerCase()
      if (![l.numeroLote, l.codigoProducto, l.nombreProducto, l.nombreUbicacion].some(valor => (valor || '').toLowerCase().includes(termino))) return false
    }
    if (filtroProducto && l.productoId !== filtroProducto) return false
    if (filtroUbicacion && (l.ubicacionId || 'drogueria') !== filtroUbicacion) return false
    if (filtroVencimiento) {
      const dias = diasRestantes(l.fechaVencimiento)
      const estado = dias < 0 ? 'vencido' : dias <= alertaDias ? 'proximo' : 'vigente'
      if (estado !== filtroVencimiento) return false
    }
    if (filtroStock === 'con_stock') return l.cantidad > 0
    if (filtroStock === 'agotados') return l.cantidad === 0
    return true
  })

  const productosUnicos = [...new Map(datos.map(l => [l.productoId, { valor: l.productoId, etiqueta: l.nombreProducto }])).values()]
  const ubicacionesUnicas = [...new Map(datos.map(l => [l.ubicacionId || 'drogueria', { valor: l.ubicacionId || 'drogueria', etiqueta: l.nombreUbicacion }])).values()]
  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroProducto('')
    setFiltroUbicacion('')
    setFiltroVencimiento('')
    setFiltroStock('con_stock')
  }

  const columnas = [
    { campo: 'numeroLote', encabezado: 'Nº Lote', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.numeroLote}</span> },
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className={`font-mono text-xs ${r.cantidad === 0 ? 'text-secundario' : ''}`}>{r.codigoProducto || '-'}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreProducto}</span> },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreUbicacion}</span> },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => r.cantidad === 0
      ? <span className="text-secundario line-through">0 <span className="not-italic text-xs">(Agotado)</span></span>
      : <span>{r.cantidad}</span>
    },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      if (r.cantidad === 0) {
        return <span className="text-secundario">{formatearFechaCorta(r.fechaVencimiento)}</span>
      }
      const dias = diasRestantes(r.fechaVencimiento)
      let color, etiqueta
      if (dias < 0) { color = 'rojo'; etiqueta = 'Vencido' }
      else if (dias <= alertaDias) { color = 'amarillo'; etiqueta = 'Próx. vencer' }
      else { color = 'verde'; etiqueta = 'Vigente' }
      return <span>{formatearFechaCorta(r.fechaVencimiento)} <Insignia color={color}>{etiqueta}</Insignia></span>
    }},
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando lotes...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1 text-principal">Lotes y Vencimientos</h1>
      </div>
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar lote..." className="w-full sm:w-72" />
        <SelectBusquedaFiltro valor={filtroProducto} alCambiar={setFiltroProducto} opciones={productosUnicos} placeholder="Producto" />
        <SelectFiltro valor={filtroUbicacion} alCambiar={setFiltroUbicacion} opciones={ubicacionesUnicas} placeholder="Todas las ubicaciones" />
        <SelectFiltro valor={filtroVencimiento} alCambiar={setFiltroVencimiento} opciones={[{ valor: 'vencido', etiqueta: 'Vencido' }, { valor: 'proximo', etiqueta: 'Próx. vencer' }, { valor: 'vigente', etiqueta: 'Vigente' }]} placeholder="Estado de vencimiento" />
        <SelectFiltro valor={filtroStock} alCambiar={setFiltroStock} opciones={[{ valor: 'con_stock', etiqueta: 'Con stock' }, { valor: 'agotados', etiqueta: 'Agotados' }, { valor: 'todos', etiqueta: 'Todos' }]} placeholder="Con stock" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={datosFiltrados} busqueda={false} />
    </div>
  )
}
