import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import useAlertaVencimientoLote from '@/state/useAlertaVencimientoLote'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { clasificarVencimiento, ESTADOS_VENCIMIENTO, fechaNegocioLotes, mostrarFechaVencimiento } from '@/utilities/vencimientoLote'

const TITULOS = { lotes: 'Lotes y Vencimientos', vencimientos: 'Clasificación de vencimiento', trazabilidad: 'Trazabilidad de lotes' }
const ESTADOS_FILTRO = ['vencido', 'proximo', 'vigente', 'sin_fecha']

export default function ListadoLotes({ vista = 'lotes', descripcion }) {
  const [searchParams] = useSearchParams()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState('')
  const stockInicial = vista === 'trazabilidad' ? 'todos' : 'con_stock'
  const [filtroStock, setFiltroStock] = useState(stockInicial)
  const { alertaDias, errorAlerta } = useAlertaVencimientoLote()
  const hoy = fechaNegocioLotes()
  const esVencimientos = vista === 'vencimientos'

  useEffect(() => {
    let vigente = true
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        if (!vigente) return
        setDatos(calcularFEFO(data))
        setCargando(false)
      })
      .catch(err => {
        if (!vigente) return
        setError(err.message)
        setCargando(false)
      })
    return () => { vigente = false }
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
    if (filtroVencimiento && clasificarVencimiento(l.fechaVencimiento, alertaDias, hoy) !== filtroVencimiento) return false
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
    setFiltroStock(stockInicial)
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
      const { color, etiqueta } = ESTADOS_VENCIMIENTO[clasificarVencimiento(r.fechaVencimiento, alertaDias, hoy)]
      return <span>{mostrarFechaVencimiento(r.fechaVencimiento)} <Insignia color={color}>{etiqueta}</Insignia></span>
    }},
    { campo: 'id', encabezado: 'Acciones', ordenable: false, render: (r) => (
      <Link to={{ pathname: r.id, search: searchParams.toString() }} className="inline-flex rounded px-2 py-1 font-medium text-marca-principal underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Ver detalle del lote ${r.numeroLote}, ${r.nombreProducto}, ${r.nombreUbicacion}`}>
        Ver detalle
      </Link>
    ) },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando lotes...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">{TITULOS[vista]}</h1>
          {esVencimientos && alertaDias != null ? <p className="mt-1 text-secundario">Se consideran próximos a vencer los lotes que vencen entre hoy y los próximos {alertaDias} días.</p> : null}
          {vista === 'trazabilidad' ? <p className="mt-1 text-secundario">Selecciona un lote para consultar sus movimientos y documentos de origen.</p> : null}
          {vista === 'lotes' && descripcion ? <p className="mt-1 text-secundario">{descripcion}</p> : null}
        </div>
      </div>
      {errorAlerta ? <p role="status" className="text-secundario">No se pudo cargar el umbral de vencimiento; solo se identifican los lotes ya vencidos.</p> : null}
      {esVencimientos && alertaDias == null && !errorAlerta ? <p role="status" className="text-secundario">Cargando umbral de vencimiento…</p> : null}
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar lote..." className="w-full sm:w-72" />
        <SelectBusquedaFiltro valor={filtroProducto} alCambiar={setFiltroProducto} opciones={productosUnicos} placeholder="Producto" />
        <SelectFiltro valor={filtroUbicacion} alCambiar={setFiltroUbicacion} opciones={ubicacionesUnicas} placeholder="Todas las ubicaciones" />
        <SelectFiltro valor={filtroVencimiento} alCambiar={setFiltroVencimiento} opciones={ESTADOS_FILTRO.map(valor => ({ valor, etiqueta: ESTADOS_VENCIMIENTO[valor].etiqueta }))} placeholder="Estado de vencimiento" />
        <SelectFiltro valor={filtroStock} alCambiar={setFiltroStock} opciones={[{ valor: 'con_stock', etiqueta: 'Con stock' }, { valor: 'agotados', etiqueta: 'Agotados' }, { valor: 'todos', etiqueta: 'Todos' }]} placeholder="Estado de stock" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={datosFiltrados} busqueda={false} />
    </div>
  )
}
