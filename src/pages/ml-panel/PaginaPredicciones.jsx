import { useEffect, useMemo, useState } from 'react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import GraficaArea from '@/components/charts/GraficaArea'
import Insignia from '@/components/common/Insignia'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarVentasHistoricasImportadas } from '@/services/supabase/ventasHistoricas'
import { generarPrediccion, obtenerMadurezSerie } from '@/services/ml-model/prediccionesML'
import { useMLStatus } from '@/services/ml-model/useMLStatus'

const HORIZONTES = [4, 8, 12]

export default function PaginaPredicciones() {
  const estadoML = useMLStatus()
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [horizonte, setHorizonte] = useState(12)
  const [madurez, setMadurez] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [indicadoresDatos, setIndicadoresDatos] = useState(null)
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
        setBoticaId(boticasData.find(b => b.tipo === 'botica')?.id || '')
        setProductoId(productosData[0]?.id || '')
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
  }, [])

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

  const datosGrafica = useMemo(() => (
    resultado?.predicciones?.map((p, index) => ({
      mes: `S${index + 1}`,
      predicho: p.cantidad_predicha,
      intervaloInf: p.intervalo_inf,
      intervaloSup: p.intervalo_sup,
      real: null,
    })) || []
  ), [resultado])

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
      render: r => (
        <span title={`Inferior exacto: ${Number(r.intervalo_inf).toFixed(2)} | Superior exacto: ${Number(r.intervalo_sup).toFixed(2)}`}>
          Entre {Math.floor(Number(r.intervalo_inf))} y {Math.ceil(Number(r.intervalo_sup))} unidades
        </span>
      ),
    },
    { campo: 'estrategia', encabezado: 'Estrategia' },
    { campo: 'nivelMadurez', encabezado: 'Nivel de madurez' },
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
        <p className="text-cuerpo text-secundario">Predicción local con FastAPI y datos reales de Supabase</p>
      </div>

      {!estadoML.cargando && !estadoML.disponible && <Alerta tipo="error" titulo="API ML no disponible" mensaje={estadoML.error} />}
      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}

      <div className="flex flex-wrap gap-4">
        <select value={boticaId} onChange={e => setBoticaId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          {boticas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <select value={productoId} onChange={e => setProductoId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md min-w-72">
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
        </select>
        <select value={horizonte} onChange={e => setHorizonte(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          {HORIZONTES.map(h => <option key={h} value={h}>{h} semanas</option>)}
        </select>
        <Boton onClick={generar} cargando={cargando} deshabilitado={!boticaId || !productoId || !estadoML.disponible}>Generar predicción</Boton>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div><p className="text-etiqueta text-secundario">Series disponibles</p><p className="font-semibold text-principal">{indicadoresDatos?.seriesDisponibles ?? '-'}</p></div>
        <div><p className="text-etiqueta text-secundario">Semanas históricas</p><p className="font-semibold text-principal">{madurez?.semanas_historial ?? 'Sin calcular'}</p></div>
        <div><p className="text-etiqueta text-secundario">Boticas con ventas</p><p className="font-semibold text-principal">{indicadoresDatos?.boticasConVentas ?? '-'}</p></div>
        <div><p className="text-etiqueta text-secundario">Fuente de madurez</p><p className="font-semibold text-principal">Backend ML</p></div>
        <div><p className="text-etiqueta text-secundario">Nivel de madurez</p><p className="font-semibold text-principal">{madurez?.nivel_madurez || 'Sin calcular'}</p></div>
        <div><p className="text-etiqueta text-secundario">Estrategia estimada</p><p className="font-semibold text-principal">{madurez?.estrategia_disponible || 'Sin calcular'}</p></div>
      </div>

      {resultado && (
        <>
          <Tarjeta titulo="Resultado de predicción" descripcion={`${producto?.nombreComercial || resultado.producto_id} · ${botica?.nombre || resultado.botica_id}`}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Insignia color="azul">Modelo: {resultado.modelo_version_id}</Insignia>
              <Insignia color="verde">{resultado.estrategia_utilizada}</Insignia>
              <Insignia color="amarillo">{resultado.nivel_madurez}</Insignia>
              <Insignia color="azul">{resultado.horizonte_semanas} semanas</Insignia>
            </div>
            <GraficaArea datos={datosGrafica} altura={320} />
          </Tarjeta>
          <Tabla columnas={columnas} datos={filas} busqueda={false} paginacion={false} />
        </>
      )}
    </div>
  )
}
