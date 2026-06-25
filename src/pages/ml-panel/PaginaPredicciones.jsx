import { useEffect, useMemo, useState } from 'react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import GraficaArea from '@/components/charts/GraficaArea'
import Insignia from '@/components/common/Insignia'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { generarPrediccion, obtenerMadurezSerie } from '@/services/ml-model/prediccionesML'
import { useMLStatus } from '@/services/ml-model/useMLStatus'

const HORIZONTES = [4, 8, 12]

function principalActivo(producto) {
  return producto?.principiosActivos?.[0] || null
}

export default function PaginaPredicciones() {
  const estadoML = useMLStatus()
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [horizonte, setHorizonte] = useState(12)
  const [madurez, setMadurez] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [boticasData, productosData] = await Promise.all([
          listarBoticas({ activas: true }),
          obtenerProductos({ activos: true }),
        ])
        setBoticas(boticasData.filter(b => b.tipo === 'botica'))
        setProductos(productosData)
        setBoticaId(boticasData.find(b => b.tipo === 'botica')?.id || '')
        setProductoId(productosData[0]?.id || '')
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
  const activo = principalActivo(producto)

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
    { campo: 'cantidad_predicha', encabezado: 'Demanda estimada', render: r => Number(r.cantidad_predicha).toFixed(2) },
    { campo: 'intervalo_inf', encabezado: 'Intervalo inferior', render: r => Number(r.intervalo_inf).toFixed(2) },
    { campo: 'intervalo_sup', encabezado: 'Intervalo superior', render: r => Number(r.intervalo_sup).toFixed(2) },
  ]

  const filas = resultado?.predicciones?.map((p, index) => ({ ...p, semana: index + 1 })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Predicciones de Demanda</h1>
        <p className="text-cuerpo text-secundario">Predicción local con FastAPI y datos reales de Supabase</p>
      </div>

      {estadoML.cargando && <Alerta tipo="info" titulo="Validando servicio ML" mensaje="Consultando estado del modelo predictivo." />}
      {!estadoML.cargando && !estadoML.disponible && <Alerta tipo="error" titulo="API ML no disponible" mensaje={estadoML.error} />}
      {estadoML.disponible && (
        <Alerta tipo={estadoML.modo === 'SUPABASE' ? 'exito' : 'advertencia'} titulo={`Modelo ${estadoML.modeloCargado ? 'cargado' : 'no cargado'}`} mensaje={`Modo: ${estadoML.modo || 'desconocido'} · Versión: ${estadoML.version || 'sin versión'}`} />
      )}
      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}

      <Tarjeta titulo="Filtros de predicción">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-etiqueta font-medium text-principal">Botica</span>
            <select value={boticaId} onChange={e => setBoticaId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              {boticas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-etiqueta font-medium text-principal">Producto</span>
            <select value={productoId} onChange={e => setProductoId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-etiqueta font-medium text-principal">Horizonte</span>
            <select value={horizonte} onChange={e => setHorizonte(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              {HORIZONTES.map(h => <option key={h} value={h}>{h} semanas</option>)}
            </select>
          </label>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Información previa">
        <div className="grid gap-3 md:grid-cols-3">
          <div><p className="text-etiqueta text-secundario">Semanas de historial</p><p className="font-semibold text-principal">{madurez?.semanas_historial ?? 'Sin calcular'}</p></div>
          <div><p className="text-etiqueta text-secundario">Nivel de madurez</p><p className="font-semibold text-principal">{madurez?.nivel_madurez || 'Sin calcular'}</p></div>
          <div><p className="text-etiqueta text-secundario">Estrategia estimada</p><p className="font-semibold text-principal">{madurez?.estrategia_disponible || 'Sin calcular'}</p></div>
          <div><p className="text-etiqueta text-secundario">Principio activo principal</p><p className="font-semibold text-principal">{activo?.principioActivoNombre || 'SIN CLASIFICAR'}</p></div>
          <div><p className="text-etiqueta text-secundario">Categoría terapéutica</p><p className="font-semibold text-principal">{producto?.clasificacion || 'SIN CLASIFICAR'}</p></div>
          <div><p className="text-etiqueta text-secundario">Código ATC</p><p className="font-semibold text-principal">{activo?.codigoAtc || 'SIN CLASIFICAR'}</p></div>
        </div>
        {!activo?.codigoAtc && <Alerta tipo="advertencia" titulo="Producto sin ATC" mensaje="La predicción puede generarse, pero el producto no tiene código ATC clasificado." className="mt-4" />}
        <div className="mt-4">
          <Boton onClick={generar} cargando={cargando} deshabilitado={!boticaId || !productoId || !estadoML.disponible}>Generar predicción</Boton>
        </div>
      </Tarjeta>

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
          <Tarjeta titulo="Detalle semanal">
            <Tabla columnas={columnas} datos={filas} busqueda={false} paginacion={false} />
          </Tarjeta>
        </>
      )}
    </div>
  )
}
