import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import useConfiguracion from '@/state/useConfiguracion'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaLotesBotica() {
  const [searchParams] = useSearchParams()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState('')
  const [filtroStock, setFiltroStock] = useState('con_stock')
  const alertaDias = useConfiguracion(s => s.config?.alertaVencimientoDias ?? 30)

  useEffect(() => {
    setCargando(true)
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        setDatos(calcularFEFO(filtrarPorBotica(usuario, data, 'ubicacionId')))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const datosFiltrados = datos.filter(l => {
    const productoId = searchParams.get('productoId')
    const ubicacionId = searchParams.get('ubicacionId')
    if (productoId && l.productoId !== productoId) return false
    if (ubicacionId && l.ubicacionId !== ubicacionId) return false
    if (busqueda.trim() && ![l.numeroLote, l.codigoProducto, l.nombreProducto].some(valor => (valor || '').toLowerCase().includes(busqueda.trim().toLowerCase()))) return false
    if (filtroVencimiento) {
      const dias = diasRestantes(l.fechaVencimiento)
      const estado = dias < 0 ? 'vencido' : dias <= alertaDias ? 'proximo' : 'vigente'
      if (estado !== filtroVencimiento) return false
    }
    if (filtroStock === 'con_stock') return l.cantidad > 0
    if (filtroStock === 'agotados') return l.cantidad === 0
    return true
  })

  const columnas = [
    { campo: 'numeroLote', encabezado: 'Nº Lote', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.numeroLote}</span> },
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className={`font-mono text-xs ${r.cantidad === 0 ? 'text-secundario' : ''}`}>{r.codigoProducto || '-'}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreProducto}</span> },
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
        <h1 className="text-h1 text-principal">Lotes de mi Botica</h1>
      </div>
      <BarraFiltros alLimpiar={() => { setBusqueda(''); setFiltroVencimiento(''); setFiltroStock('con_stock') }}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar lote..." className="w-full sm:w-72" />
        <SelectFiltro valor={filtroVencimiento} alCambiar={setFiltroVencimiento} opciones={[{ valor: 'vencido', etiqueta: 'Vencido' }, { valor: 'proximo', etiqueta: 'Próx. vencer' }, { valor: 'vigente', etiqueta: 'Vigente' }]} placeholder="Estado de vencimiento" />
        <SelectFiltro valor={filtroStock} alCambiar={setFiltroStock} opciones={[{ valor: 'con_stock', etiqueta: 'Con stock' }, { valor: 'agotados', etiqueta: 'Agotados' }, { valor: 'todos', etiqueta: 'Todos' }]} placeholder="Con stock" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={datosFiltrados} busqueda={false} />
    </div>
  )
}
