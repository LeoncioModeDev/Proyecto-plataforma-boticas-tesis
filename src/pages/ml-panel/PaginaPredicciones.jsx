import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import SelectFiltro from '@/components/common/SelectFiltro'
import GraficaArea from '@/components/charts/GraficaArea'
import Insignia from '@/components/common/Insignia'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarVentasHistoricasImportadas } from '@/services/supabase/ventasHistoricas'
import { generarPrediccion, obtenerMadurezSerie } from '@/services/ml-model/prediccionesML'
import { useMLStatus } from '@/services/ml-model/useMLStatus'

const HORIZONTES = [4, 8, 12]

const ETIQUETAS_MADUREZ = {
  SIN_DATOS: 'Sin datos suficientes',
  HISTORIAL_INICIAL: 'Historial inicial',
  HISTORIAL_INTERMEDIO: 'Historial intermedio',
  PREDICCION_LIMITADA: 'Prediccion limitada',
  MODELO_COMPLETO: 'Modelo completo',
}

const ETIQUETAS_ESTRATEGIA = {
  SIN_PRONOSTICO_ESTADISTICO: 'Sin pronostico estadistico',
  PROMEDIO_FALLBACK: 'Promedio operativo',
  PROMEDIO_RECIENTE: 'Promedio reciente',
  XGBOOST_GLOBAL_CON_FEATURES_OFICIALES: 'XGBoost global',
  XGBOOST_GLOBAL_CON_FALLBACK_MADURO: 'XGBoost global para serie madura',
  HIBRIDO_SARIMA_XGBOOST_ADAPTATIVO: 'SARIMA + XGBoost hibrido',
  FALLBACK_OPERATIVO: 'Fallback operativo',
}

function etiquetaMadurez(valor) {
  return ETIQUETAS_MADUREZ[valor] || valor || 'Sin calcular'
}

function etiquetaEstrategia(valor) {
  return ETIQUETAS_ESTRATEGIA[valor] || valor || 'Sin calcular'
}

function formatearNumero(valor, decimales = 0) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—'
}

function formatearRango(inferior, superior) {
  if (inferior == null && superior == null) return 'No disponible'
  if (inferior == null || superior == null) return 'No disponible'
  return `${Math.floor(Number(inferior))} - ${Math.ceil(Number(superior))} unidades`
}

function inicioSemana(fecha) {
  const base = new Date(fecha)
  if (Number.isNaN(base.getTime())) return null
  const dia = base.getDay() || 7
  base.setDate(base.getDate() - dia + 1)
  base.setHours(0, 0, 0, 0)
  return base.toISOString().slice(0, 10)
}

export default function PaginaPredicciones() {
  const estadoML = useMLStatus()
  const [parametrosBusqueda] = useSearchParams()
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [horizonte, setHorizonte] = useState(12)
  const [madurez, setMadurez] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [indicadoresDatos, setIndicadoresDatos] = useState(null)
  const [ventasHistoricas, setVentasHistoricas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [boticasData, productosData, ventasData] = await Promise.all([
          listarBoticas({ activas: true }),
          obtenerProductos({ activos: true }),
          listarVentasHistoricasImportadas({ limite: 1000 }),
        ])
        setBoticas(boticasData.filter(b => b.tipo === 'botica'))
        setProductos(productosData)
        const boticasActivas = boticasData.filter(b => b.tipo === 'botica')
        setBoticaId(parametrosBusqueda.get('boticaId') || boticasActivas[0]?.id || '')
        setProductoId(parametrosBusqueda.get('productoId') || productosData[0]?.id || '')
        setIndicadoresDatos({
          seriesDisponibles: new Set((ventasData.datos || []).map(v => `${v.botica_id}-${v.producto_id}`)).size,
          semanasHistoricas: null,
          categorias: new Set(productosData.map(p => p.categoriaTerapeuticaId || p.categoriaTerapeuticaNombre || p.clasificacion).filter(Boolean)).size,
          productosSinCategoria: productosData.filter(p => !p.categoriaTerapeuticaId && !p.categoriaTerapeuticaNombre && !p.clasificacion).length,
          boticasConVentas: new Set((ventasData.datos || []).map(v => v.botica_id).filter(Boolean)).size,
        })
      } catch (err) {
        setError(err.message)
      }
    }
    cargarCatalogos()
  }, [parametrosBusqueda])

  useEffect(() => {
    if (!boticaId || !productoId) return
    const controller = new AbortController()
    async function cargarHistoricoSerie() {
      try {
        const ventasData = await listarVentasHistoricasImportadas({
          boticaId,
          productoId,
          limite: 5000,
          ordenCampo: 'fecha_venta',
          ascendente: false,
        })
        if (!controller.signal.aborted) setVentasHistoricas(ventasData.datos || [])
      } catch (err) {
        if (!controller.signal.aborted) {
          setVentasHistoricas([])
          setError(err.message)
        }
      }
    }
    cargarHistoricoSerie()
    return () => controller.abort()
  }, [boticaId, productoId])

  useEffect(() => {
    if (!boticaId || !productoId) return
    const controller = new AbortController()
    async function cargarMadurez() {
      try {
        setMadurez(await obtenerMadurezSerie(boticaId, productoId, { signal: controller.signal }))
      } catch {
        if (!controller.signal.aborted) setMadurez(null)
      }
    }
    cargarMadurez()
    return () => controller.abort()
  }, [boticaId, productoId])

  const producto = productos.find(p => p.id === productoId)
  const botica = boticas.find(b => b.id === boticaId)
  const categoriaProducto = producto?.categoriaTerapeuticaNombre || producto?.categoria_terapeutica || producto?.clasificacion || 'Sin categoria'
  const opcionesBoticas = boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))
  const opcionesProductos = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial || p.nombre || p.id }))
  const opcionesHorizontes = HORIZONTES.map(h => ({ valor: String(h), etiqueta: `${h} semanas` }))

  const limpiarFiltros = () => {
    setBoticaId('')
    setProductoId('')
    setHorizonte(12)
    setResultado(null)
    setVentasHistoricas([])
  }

  const cambiarBotica = (valor) => {
    setBoticaId(valor)
    setResultado(null)
    setVentasHistoricas([])
  }

  const cambiarProducto = (valor) => {
    setProductoId(valor)
    setResultado(null)
    setVentasHistoricas([])
  }

  const cambiarHorizonte = (valor) => {
    setHorizonte(valor)
    setResultado(null)
  }

  const resumenResultado = useMemo(() => {
    const predicciones = resultado?.predicciones || []
    const total = predicciones.reduce((acc, p) => acc + Number(p.cantidad_predicha || 0), 0)
    const promedio = predicciones.length ? total / predicciones.length : 0
    return { total, promedio }
  }, [resultado])

  const datosGrafica = useMemo(() => {
    const historico = new Map()
    ventasHistoricas
      .filter(v => v.botica_id === boticaId && v.producto_id === productoId)
      .forEach(v => {
        const semana = inicioSemana(v.fecha_venta || v.fecha || v.fecha_semana)
        if (!semana) return
        historico.set(semana, (historico.get(semana) || 0) + Number(v.cantidad || v.cantidad_vendida || 0))
      })

    const filasHistoricas = [...historico.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([semana, cantidad]) => ({ mes: semana, real: cantidad, predicho: null, intervaloInf: null, intervaloSup: null, tipo: 'Historico' }))

    const filasPrediccion = resultado?.predicciones?.map(p => {
      const cantidadPredicha = Number(p.cantidad_predicha)
      return {
        mes: `H${p.horizonte}`,
        predicho: Number.isFinite(cantidadPredicha) ? cantidadPredicha : null,
        intervaloInf: p.intervalo_inf,
        intervaloSup: p.intervalo_sup,
        real: null,
        tipo: 'Pronostico',
      }
    }) || []

    return [...filasHistoricas, ...filasPrediccion]
  }, [resultado, ventasHistoricas, boticaId, productoId])

  async function generar() {
    setCargando(true)
    setError(null)
    try {
      const data = await generarPrediccion({ botica_id: boticaId, producto_id: productoId, horizonte_semanas: Number(horizonte) })
      setResultado(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const columnas = [
    { campo: 'semana', encabezado: 'Semana' },
    { campo: 'periodo_inicio', encabezado: 'Fecha inicial' },
    { campo: 'periodo_fin', encabezado: 'Fecha final' },
    {
      campo: 'cantidad_predicha',
      encabezado: 'Demanda estimada',
      render: r => (
        <span title={`Exacto: ${Number(r.cantidad_predicha).toFixed(2)} | SARIMA: ${r.prediccion_sarima ?? '-'} | XGBoost: ${r.prediccion_xgboost ?? '-'} | alpha: ${r.alpha ?? '-'} | método: ${r.metodo_aplicado ?? '-'}`}>
          {Math.ceil(Number(r.cantidad_predicha))} unidades
        </span>
      ),
    },
    {
      campo: 'rango_esperado',
      encabezado: 'Rango esperado',
      render: r => <span>{formatearRango(r.intervalo_inf, r.intervalo_sup)}</span>,
    },
    {
      campo: 'detalle',
      encabezado: 'Detalle tecnico',
      render: r => (
        <details className="text-xs text-secundario">
          <summary className="cursor-pointer text-principal">Ver detalle</summary>
          <div className="mt-2 space-y-1">
            <p>SARIMA: {r.prediccion_sarima ?? 'No disponible'}</p>
            <p>XGBoost: {r.prediccion_xgboost ?? 'No disponible'}</p>
            <p>Metodo: {r.metodo_aplicado || 'No disponible'}</p>
            <p>Alpha: {r.alpha ?? 'No disponible'}</p>
          </div>
        </details>
      ),
    },
  ]

  const filas = resultado?.predicciones?.map((p, index) => ({
    ...p,
    semana: index + 1,
    estrategia: resultado.estrategia_utilizada,
    nivelMadurez: resultado.nivel_madurez,
  })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Predicciones de Demanda</h1>
        <p className="text-cuerpo text-secundario">Pronostico semanal de demanda por Botica x Producto</p>
      </div>

      {!estadoML.cargando && !estadoML.disponible && <Alerta tipo="error" titulo="Servicio predictivo no disponible" mensaje={estadoML.error} />}
      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <SelectBusquedaFiltro valor={boticaId} alCambiar={cambiarBotica} opciones={opcionesBoticas} placeholder="Botica" />
        <SelectBusquedaFiltro valor={productoId} alCambiar={cambiarProducto} opciones={opcionesProductos} placeholder="Producto" className="sm:w-72" />
        <SelectFiltro valor={String(horizonte)} alCambiar={cambiarHorizonte} opciones={opcionesHorizontes} placeholder="Horizonte" className="sm:w-44" />
        <Boton className="w-full sm:w-auto" onClick={generar} cargando={cargando} deshabilitado={!boticaId || !productoId || !estadoML.disponible}>Generar predicción</Boton>
      </BarraFiltros>

      <div className="grid gap-3 md:grid-cols-3">
        <div><p className="text-etiqueta text-secundario">Series disponibles</p><p className="font-semibold text-principal">{indicadoresDatos?.seriesDisponibles ?? '-'}</p></div>
        <div><p className="text-etiqueta text-secundario">Semanas históricas</p><p className="font-semibold text-principal">{madurez?.semanas_historial ?? 'Sin calcular'}</p></div>
        <div><p className="text-etiqueta text-secundario">Boticas con ventas</p><p className="font-semibold text-principal">{indicadoresDatos?.boticasConVentas ?? '-'}</p></div>
        <div><p className="text-etiqueta text-secundario">Fuente de madurez</p><p className="font-semibold text-principal">Servicio predictivo</p></div>
        <div><p className="text-etiqueta text-secundario">Nivel de madurez</p><p className="font-semibold text-principal">{etiquetaMadurez(madurez?.nivel_madurez)}</p></div>
        <div><p className="text-etiqueta text-secundario">Estrategia estimada</p><p className="font-semibold text-principal">{etiquetaEstrategia(madurez?.estrategia_disponible)}</p></div>
      </div>

      {resultado && (
        <>
          <Tarjeta titulo="Contexto de la serie" descripcion={`${producto?.nombreComercial || resultado.producto_id} · ${botica?.nombre || resultado.botica_id}`}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Insignia color="azul">Modelo: {resultado.modelo_version_id}</Insignia>
              <Insignia color="verde">Estrategia: {etiquetaEstrategia(resultado.estrategia_utilizada)}</Insignia>
              <Insignia color="amarillo">Madurez: {etiquetaMadurez(resultado.nivel_madurez)}</Insignia>
              <Insignia color="azul">{resultado.horizonte_semanas} semanas</Insignia>
            </div>
            <div className="grid gap-3 md:grid-cols-3 mb-5">
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Botica</p><p className="font-semibold text-principal">{botica?.nombre || resultado.botica_id}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Producto</p><p className="font-semibold text-principal">{producto?.nombreComercial || resultado.producto_id}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Categoria terapeutica</p><p className="font-semibold text-principal">{categoriaProducto}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Semanas de historial</p><p className="font-semibold text-principal">{resultado.semanas_historial}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Total estimado</p><p className="text-h3 text-marca-principal">{formatearNumero(resumenResultado.total)} unidades</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Promedio semanal</p><p className="text-h3 text-marca-principal">{formatearNumero(resumenResultado.promedio, 1)} unidades</p></div>
            </div>
            <p className="text-sm text-secundario mb-4">Demanda estimada para las proximas {resultado.horizonte_semanas} semanas. Las semanas futuras son pronostico, no ventas garantizadas. El rango esperado aparece como no disponible mientras el modelo no entregue intervalos calibrados.</p>
            <GraficaArea datos={datosGrafica} altura={320} />
          </Tarjeta>
          <Tabla columnas={columnas} datos={filas} busqueda={false} paginacion={false} mensajeVacio="Seleccione una botica y un producto para generar un pronostico." />
        </>
      )}
    </div>
  )
}
