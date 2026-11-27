import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import useAlertaVencimientoLote from '@/state/useAlertaVencimientoLote'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { clasificarVencimiento, ESTADOS_VENCIMIENTO, fechaNegocioLotes, mostrarFechaVencimiento } from '@/utilities/vencimientoLote'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaLotesBotica() {
  const [searchParams] = useSearchParams()
  const { usuario } = useAutenticacion()
  const [resultado, setResultado] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState('')
  const [filtroStock, setFiltroStock] = useState('con_stock')
  const { alertaDias, errorAlerta } = useAlertaVencimientoLote()
  const hoy = fechaNegocioLotes()

  useEffect(() => {
    let vigente = true
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        if (vigente) setResultado({ usuario, datos: calcularFEFO(filtrarPorBotica(usuario, data, 'ubicacionId')) })
      })
      .catch(err => {
        if (vigente) setResultado({ usuario, error: err.message })
      })
    return () => { vigente = false }
  }, [usuario])

  const cargando = resultado === null || resultado.usuario !== usuario
  const { datos = [], error } = cargando ? {} : resultado
  const datosFiltrados = datos.filter(l => {
    const productoId = searchParams.get('productoId')
    const ubicacionId = searchParams.get('ubicacionId')
    if (productoId && l.productoId !== productoId) return false
    if (ubicacionId && l.ubicacionId !== ubicacionId) return false
    if (busqueda.trim() && ![l.numeroLote, l.codigoProducto, l.nombreProducto].some(valor => (valor || '').toLowerCase().includes(busqueda.trim().toLowerCase()))) return false
    if (filtroVencimiento && clasificarVencimiento(l.fechaVencimiento, alertaDias, hoy) !== filtroVencimiento) return false
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
        <h1 className="text-h1 text-principal">Lotes de mi Botica</h1>
      </div>
      {errorAlerta ? <p role="status" className="text-secundario">No se pudo cargar el umbral de vencimiento; solo se identifican los lotes ya vencidos.</p> : null}
      <BarraFiltros alLimpiar={() => { setBusqueda(''); setFiltroVencimiento(''); setFiltroStock('con_stock') }}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar lote..." className="w-full sm:w-72" />
        <SelectFiltro valor={filtroVencimiento} alCambiar={setFiltroVencimiento} opciones={['vencido', 'proximo', 'vigente', 'sin_fecha'].map(valor => ({ valor, etiqueta: ESTADOS_VENCIMIENTO[valor].etiqueta }))} placeholder="Estado de vencimiento" />
        <SelectFiltro valor={filtroStock} alCambiar={setFiltroStock} opciones={[{ valor: 'con_stock', etiqueta: 'Con stock' }, { valor: 'agotados', etiqueta: 'Agotados' }, { valor: 'todos', etiqueta: 'Todos' }]} placeholder="Con stock" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={datosFiltrados} busqueda={false} />
    </div>
  )
}
