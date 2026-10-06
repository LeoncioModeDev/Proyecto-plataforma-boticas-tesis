import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarCategoriasTerapeuticas } from '@/services/supabase/categoriasTerapeuticas'
import { obtenerOpcionesFormasFarmaceuticas, obtenerOpcionesPrincipiosActivos } from '@/services/supabase/catalogo'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION, OPCIONES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

function enriquecerProductos(productos) {
  return productos.map(p => ({
    ...p,
    principioActivoDisplay: (p.principiosActivos || []).map(pa => pa.principioActivoNombre).join(', '),
    concentracionDisplay: (p.principiosActivos || []).map(pa => `${pa.concentracion} ${pa.unidadMedidaSimbolo || ''}`).join(', '),
    formaDisplay: p.formaFarmaceuticaNombre || p.formaFarmaceuticaId || '—',
    categoriaDisplay: p.categoriaTerapeuticaNombre || 'Sin categoría',
    presentacionDisplay: p.presentacion || '—',
  }))
}

export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [parametrosBusqueda] = useSearchParams()
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPrincipioActivo, setFiltroPrincipioActivo] = useState('')
  const [filtroForma, setFiltroForma] = useState('')
  const [filtroClasificacion, setFiltroClasificacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [categorias, setCategorias] = useState([])
  const [principiosActivos, setPrincipiosActivos] = useState([])
  const [formas, setFormas] = useState([])

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true)
      setError(null)
      const [datos, categoriasData, formasData, principiosData] = await Promise.all([
        obtenerProductos(),
        listarCategoriasTerapeuticas({ activo: true }).catch(() => []),
        obtenerOpcionesFormasFarmaceuticas().catch(() => []),
        obtenerOpcionesPrincipiosActivos().catch(() => []),
      ])
      setProductos(enriquecerProductos(datos))
      setCategorias(categoriasData.map(c => ({ valor: c.id, etiqueta: c.nombre })))
      setFormas(formasData)
      setPrincipiosActivos(principiosData)

      const productoIdInicial = parametrosBusqueda.get('productoId')
      const productoInicial = datos.find(p => p.id === productoIdInicial)
      if (productoInicial) {
        setBusqueda(productoInicial.nombreComercial || productoInicial.codigoInterno || '')
        setFiltroCategoria(productoInicial.categoriaTerapeuticaId || '')
        setFiltroForma(productoInicial.formaFarmaceuticaId || '')
        setFiltroClasificacion(productoInicial.clasificacion || '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [parametrosBusqueda])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDatos() }, [cargarDatos])

  const datosFiltrados = productos.filter(p => {
    const termino = busqueda.trim().toLowerCase()
    const matchBusqueda = termino
      ? [p.codigoInterno, p.nombreComercial, p.principioActivoDisplay].some(valor => (valor || '').toLowerCase().includes(termino))
      : true
    const matchCategoria = filtroCategoria ? p.categoriaTerapeuticaId === filtroCategoria : true
    const matchPrincipioActivo = filtroPrincipioActivo ? p.principiosActivos?.some(pa => pa.principioActivoId === filtroPrincipioActivo) : true
    const matchForma = filtroForma ? p.formaFarmaceuticaId === filtroForma : true
    const matchClasificacion = filtroClasificacion ? p.clasificacion === filtroClasificacion : true
    const matchEstado = filtroEstado ? p.estado === filtroEstado : true
    return matchBusqueda && matchCategoria && matchPrincipioActivo && matchForma && matchClasificacion && matchEstado
  })

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroCategoria('')
    setFiltroPrincipioActivo('')
    setFiltroForma('')
    setFiltroClasificacion('')
    setFiltroEstado('')
  }

  const columnas = [
    { campo: 'codigoInterno', encabezado: 'Código', render: (r) => <span className="font-mono text-xs font-medium">{r.codigoInterno}</span> },
    { campo: 'nombreComercial', encabezado: 'Nombre Comercial' },
    { campo: 'categoriaDisplay', encabezado: 'Categoría' },
    { campo: 'principioActivoDisplay', encabezado: 'Principio Activo' },
    { campo: 'formaDisplay', encabezado: 'Forma', render: (r) => <span className="capitalize">{r.formaDisplay}</span> },
    { campo: 'concentracionDisplay', encabezado: 'Concentración' },
    { campo: 'presentacionDisplay', encabezado: 'Presentación' },
    { campo: 'clasificacion', encabezado: 'Clasificación', render: (r) => <Insignia color={COLORES_CLASIFICACION[r.clasificacion]}>{ETIQUETAS_CLASIFICACION[r.clasificacion]}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO[r.estado]}>{ETIQUETAS_ESTADO[r.estado]}</Insignia> },
  ]

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando catálogo...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Catálogo de Productos</h1>
          <p className="text-secundario mt-1">{datosFiltrados.length} productos encontrados</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/catalogo/nuevo')}>Agregar producto</Boton>
      </div>

      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar producto..." className="w-full sm:w-72" />
        <SelectBusquedaFiltro valor={filtroCategoria} alCambiar={setFiltroCategoria} opciones={categorias} placeholder="Categoría terapéutica" />
        <SelectBusquedaFiltro valor={filtroPrincipioActivo} alCambiar={setFiltroPrincipioActivo} opciones={principiosActivos} placeholder="Principio activo" />
        <SelectBusquedaFiltro valor={filtroForma} alCambiar={setFiltroForma} opciones={formas} placeholder="Forma farmacéutica" />
        <SelectFiltro valor={filtroClasificacion} alCambiar={setFiltroClasificacion} opciones={OPCIONES_CLASIFICACION} placeholder="Todas las clasificaciones" />
        <SelectFiltro valor={filtroEstado} alCambiar={setFiltroEstado} opciones={[{ valor: 'activo', etiqueta: 'Activo' }, { valor: 'inactivo', etiqueta: 'Inactivo' }, { valor: 'descontinuado', etiqueta: 'Descontinuado' }]} placeholder="Todos los estados" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={datosFiltrados} busqueda={false} alClickFila={(p) => navegar(`/central/inventario/catalogo/${p.id}`)} />
    </div>
  )
}
