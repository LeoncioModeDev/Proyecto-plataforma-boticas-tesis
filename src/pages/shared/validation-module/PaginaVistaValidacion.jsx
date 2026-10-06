import { useEffect, useState } from 'react'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Tarjeta from '@/components/common/Tarjeta'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import Paginacion from '@/components/common/Paginacion'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarCategoriasTerapeuticas } from '@/services/supabase/categoriasTerapeuticas'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'

const LIMITE = 10

export default function PaginaVistaValidacion({
  titulo,
  descripcion,
  columnas,
  cargarDatos,
  filtrosExtra,
  metricas,
  placeholderBusqueda = 'Buscar por codigo o nombre de producto...',
  mensajeCargando = 'Cargando datos importados...',
}) {
  const { usuario } = useAutenticacion()
  const esVisorBotica = usuario?.rol === ROLES.VISOR_BOTICA
  const [datos, setDatos] = useState([])
  const [total, setTotal] = useState(0)
  const [resumen, setResumen] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [extra, setExtra] = useState({})
  const [opciones, setOpciones] = useState({ boticas: [], productos: [], categorias: [] })

  useEffect(() => {
    Promise.all([
      listarBoticas({ activas: true }).catch(() => []),
      obtenerProductos({ activos: true }).catch(() => []),
      listarCategoriasTerapeuticas({ activo: true }).catch(() => []),
    ]).then(([boticas, productos, categorias]) => {
      const boticasPermitidas = esVisorBotica ? boticas.filter(b => b.id === usuario?.boticaId) : boticas
      setOpciones({ boticas: boticasPermitidas, productos, categorias })
    })
  }, [esVisorBotica, usuario?.boticaId])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const resultado = await cargarDatos({
          pagina,
          limite: LIMITE,
          busqueda,
          boticaId: esVisorBotica ? usuario?.boticaId : boticaId,
          productoId,
          categoria,
          fechaDesde,
          fechaHasta,
          ...extra,
        })
        if (cancelado) return
        setDatos(resultado.datos || [])
        setTotal(resultado.total || 0)
        setResumen(resultado.resumen || {})
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [busqueda, boticaId, productoId, categoria, fechaDesde, fechaHasta, extra, pagina, cargarDatos, esVisorBotica, usuario?.boticaId])

  const totalPaginas = Math.max(Math.ceil(total / LIMITE), 1)
  const tarjetasMetricas = typeof metricas === 'function' ? metricas({ total, datos, resumen }) : null

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }

  function actualizarExtra(nombre, valor) {
    setExtra(prev => ({ ...prev, [nombre]: valor }))
    setPagina(1)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setBoticaId('')
    setProductoId('')
    setCategoria('')
    setFechaDesde('')
    setFechaHasta('')
    setExtra({})
    setPagina(1)
  }

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">{mensajeCargando}</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">{titulo}</h1>
        <p className="text-secundario mt-1">{descripcion || `${total} registros encontrados`}</p>
        {descripcion && <p className="text-secundario mt-1">{total} registros encontrados</p>}
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar la vista" mensaje={error} />}

      {tarjetasMetricas?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {tarjetasMetricas.map(({ etiqueta, valor, icono: Icono }) => (
            <Tarjeta key={etiqueta}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-secundario">{etiqueta}</p>
                  <p className="text-2xl font-semibold text-principal mt-1">{valor}</p>
                </div>
                {Icono && <Icono className="h-5 w-5 text-marca-principal" />}
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      <BarraFiltros alLimpiar={limpiarFiltros}>
          <CampoBusqueda valor={busqueda} alCambiar={valor => actualizarFiltro(setBusqueda, valor)} placeholder={placeholderBusqueda} className="w-full sm:w-72" />
          {!esVisorBotica && <SelectFiltro valor={boticaId} alCambiar={valor => actualizarFiltro(setBoticaId, valor)} opciones={opciones.boticas.map(botica => ({ valor: botica.id, etiqueta: botica.nombre }))} placeholder="Todas las ubicaciones" />}
          <SelectBusquedaFiltro valor={productoId} alCambiar={valor => actualizarFiltro(setProductoId, valor)} opciones={opciones.productos.map(producto => ({ valor: producto.id, etiqueta: producto.nombreComercial }))} placeholder="Producto" />
          <SelectBusquedaFiltro valor={categoria} alCambiar={valor => actualizarFiltro(setCategoria, valor)} opciones={opciones.categorias.map(cat => ({ valor: cat.nombre, etiqueta: cat.nombre }))} placeholder="Categoría" />
          <label className="flex flex-col gap-1 text-xs text-secundario">
            Desde
            <input type="date" value={fechaDesde} onChange={e => actualizarFiltro(setFechaDesde, e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-secundario">
            Hasta
            <input type="date" value={fechaHasta} onChange={e => actualizarFiltro(setFechaHasta, e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" />
          </label>
          {filtrosExtra?.map(filtro => filtro.tipo === 'texto' ? (
            <input
              key={filtro.nombre}
              type="text"
              value={extra[filtro.nombre] ?? ''}
              onChange={e => actualizarExtra(filtro.nombre, e.target.value)}
              placeholder={filtro.placeholder}
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
            />
          ) : (
            <SelectFiltro key={filtro.nombre} valor={extra[filtro.nombre] ?? ''} alCambiar={valor => actualizarExtra(filtro.nombre, filtro.parsear ? filtro.parsear(valor) : valor)} opciones={filtro.opciones} placeholder={filtro.placeholder} />
          ))}
      </BarraFiltros>

      <Tabla columnas={columnas} datos={datos} busqueda={false} paginacion={false} />
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={total} alCambiar={setPagina} />
    </div>
  )
}
