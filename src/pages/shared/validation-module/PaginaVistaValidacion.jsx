import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarCategoriasTerapeuticas } from '@/services/supabase/categoriasTerapeuticas'

const LIMITE = 20

export default function PaginaVistaValidacion({
  titulo,
  columnas,
  cargarDatos,
  filtrosExtra,
  placeholderBusqueda = 'Buscar por codigo o nombre de producto...',
  mensajeCargando = 'Cargando datos importados...',
}) {
  const [datos, setDatos] = useState([])
  const [total, setTotal] = useState(0)
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
      setOpciones({ boticas, productos, categorias })
    })
  }, [])

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
          boticaId,
          productoId,
          categoria,
          fechaDesde,
          fechaHasta,
          ...extra,
        })
        if (cancelado) return
        setDatos(resultado.datos || [])
        setTotal(resultado.total || 0)
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [busqueda, boticaId, productoId, categoria, fechaDesde, fechaHasta, extra, pagina, cargarDatos])

  const totalPaginas = Math.max(Math.ceil(total / LIMITE), 1)

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }

  function actualizarExtra(nombre, valor) {
    setExtra(prev => ({ ...prev, [nombre]: valor }))
    setPagina(1)
  }

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">{mensajeCargando}</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">{titulo}</h1>
        <p className="text-secundario mt-1">{total} registros encontrados</p>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar la vista" mensaje={error} />}

      <div className="flex flex-wrap gap-4">
          <CampoBusqueda valor={busqueda} alCambiar={valor => actualizarFiltro(setBusqueda, valor)} placeholder={placeholderBusqueda} className="min-w-72" />
          <select value={boticaId} onChange={e => actualizarFiltro(setBoticaId, e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value="">Todas las boticas</option>
            {opciones.boticas.map(botica => <option key={botica.id} value={botica.id}>{botica.nombre}</option>)}
          </select>
          <select value={productoId} onChange={e => actualizarFiltro(setProductoId, e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value="">Todos los productos</option>
            {opciones.productos.map(producto => <option key={producto.id} value={producto.id}>{producto.nombreComercial}</option>)}
          </select>
          <select value={categoria} onChange={e => actualizarFiltro(setCategoria, e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value="">Todas las categorias</option>
            {opciones.categorias.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
          </select>
          <input type="date" value={fechaDesde} onChange={e => actualizarFiltro(setFechaDesde, e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md" />
          <input type="date" value={fechaHasta} onChange={e => actualizarFiltro(setFechaHasta, e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md" />
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
            <select key={filtro.nombre} value={extra[filtro.nombre] ?? ''} onChange={e => actualizarExtra(filtro.nombre, filtro.parsear ? filtro.parsear(e.target.value) : e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              <option value="">{filtro.placeholder}</option>
              {filtro.opciones.map(opcion => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
            </select>
          ))}
      </div>

      <Tabla columnas={columnas} datos={datos} busqueda={false} paginacion={false} />
      <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2 text-sm text-secundario">
        <span>Pagina {pagina} de {totalPaginas} - {total} registros</span>
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="pequeno" icono={ChevronLeft} deshabilitado={pagina <= 1} onClick={() => setPagina(p => Math.max(p - 1, 1))}>Anterior</Boton>
          <Boton variante="secundario" tamano="pequeno" icono={ChevronRight} deshabilitado={pagina >= totalPaginas} onClick={() => setPagina(p => Math.min(p + 1, totalPaginas))}>Siguiente</Boton>
        </div>
      </div>
    </div>
  )
}
