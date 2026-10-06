import { useEffect, useMemo, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Tabla from '@/components/common/Tabla'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import SelectFiltro from '@/components/common/SelectFiltro'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { obtenerProductos } from '@/services/supabase/productos'
import { formatearFechaCorta, formatearFechaHora } from '@/utilities/formatearFecha'

const TODOS = 'TODOS'

function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—'
}

function formatearRango(inferior, superior) {
  if (inferior == null && superior == null) return 'No disponible'
  if (inferior == null || superior == null) return 'No disponible'
  return `${formatearNumero(inferior)} - ${formatearNumero(superior)}`
}

function resumirEstrategia(valor) {
  const etiquetas = {
    HIBRIDO_SARIMA_XGBOOST_ADAPTATIVO: 'SARIMA + XGBoost hibrido',
    XGBOOST_GLOBAL_CON_FEATURES_OFICIALES: 'XGBoost global',
    XGBOOST_GLOBAL_CON_FALLBACK_MADURO: 'XGBoost global',
    FALLBACK_OPERATIVO: 'Fallback operativo',
  }
  return etiquetas[valor] || valor || '—'
}

function resumirMadurez(valor) {
  const etiquetas = {
    MODELO_COMPLETO: 'Modelo completo',
    PREDICCION_LIMITADA: 'Prediccion limitada',
    HISTORIAL_INTERMEDIO: 'Historial intermedio',
    HISTORIAL_INICIAL: 'Historial inicial',
    SIN_DATOS: 'Sin datos suficientes',
  }
  return etiquetas[valor] || valor || '—'
}

function formatearFechaSegura(fecha) {
  if (!fecha) return '—'
  try {
    return String(fecha).includes('T') ? formatearFechaHora(fecha) : formatearFechaCorta(fecha)
  } catch {
    return fecha
  }
}

function construirNombreMapa(items, campoNombre) {
  return Object.fromEntries(items.map(item => [item.id, item[campoNombre] || item.nombre || item.nombreComercial || item.id]))
}

export default function PaginaHistorialPredicciones() {
  const [predicciones, setPredicciones] = useState([])
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [filtros, setFiltros] = useState({ boticaId: TODOS, productoId: TODOS, estrategia: TODOS, madurez: TODOS, modelo: TODOS })

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [predData, boticasData, productosData] = await Promise.all([
        obtenerPredicciones(),
        listarBoticas({ activas: true }),
        obtenerProductos({ activos: true }),
      ])
      setPredicciones(predData)
      setBoticas(boticasData.filter(b => b.tipo === 'botica'))
      setProductos(productosData)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    async function cargarInicial() {
      await cargar()
    }
    cargarInicial()
  }, [])

  const nombresBotica = useMemo(() => construirNombreMapa(boticas, 'nombre'), [boticas])
  const nombresProducto = useMemo(() => construirNombreMapa(productos, 'nombreComercial'), [productos])

  const opciones = useMemo(() => ({
    estrategias: [...new Set(predicciones.map(p => p.estrategia).filter(Boolean))].sort(),
    madurez: [...new Set(predicciones.map(p => p.nivelMadurez).filter(Boolean))].sort(),
    modelos: [...new Set(predicciones.map(p => p.modeloVersionId).filter(Boolean))].sort(),
  }), [predicciones])

  const filas = useMemo(() => {
    const filtradas = predicciones
    .filter(p => filtros.boticaId === TODOS || p.boticaId === filtros.boticaId)
    .filter(p => filtros.productoId === TODOS || p.productoId === filtros.productoId)
    .filter(p => filtros.estrategia === TODOS || p.estrategia === filtros.estrategia)
    .filter(p => filtros.madurez === TODOS || p.nivelMadurez === filtros.madurez)
    .filter(p => filtros.modelo === TODOS || p.modeloVersionId === filtros.modelo)

    const grupos = new Map()
    filtradas.forEach(p => {
      const clave = [p.generadoEn, p.boticaId, p.productoId, p.modeloVersionId].join('|')
      const actual = grupos.get(clave) || { ...p, predicciones: [], demandaTotal: 0 }
      actual.predicciones.push(p)
      actual.demandaTotal += Number(p.cantidadPredicha || 0)
      grupos.set(clave, actual)
    })

    return [...grupos.values()].map(p => {
      const ordenadas = [...p.predicciones].sort((a, b) => Number(a.horizonte || 0) - Number(b.horizonte || 0))
      return {
        ...p,
        predicciones: ordenadas,
        horizonteResumen: `${ordenadas.length} semanas`,
        nombreBotica: nombresBotica[p.boticaId] || p.boticaId,
        nombreProducto: nombresProducto[p.productoId] || p.productoId,
        periodo: `${formatearFechaSegura(ordenadas[0]?.periodoInicio)} - ${formatearFechaSegura(ordenadas.at(-1)?.periodoFin)}`,
      }
    })
  }, [predicciones, filtros, nombresBotica, nombresProducto])

  const actualizarFiltro = (campo, valor) => setFiltros(prev => ({ ...prev, [campo]: valor }))
  const limpiarFiltros = () => setFiltros({ boticaId: TODOS, productoId: TODOS, estrategia: TODOS, madurez: TODOS, modelo: TODOS })
  const opcionesBoticas = boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))
  const opcionesProductos = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial || p.nombre || p.id }))
  const opcionesEstrategias = [{ valor: TODOS, etiqueta: 'Todas las estrategias' }, ...opciones.estrategias.map(e => ({ valor: e, etiqueta: resumirEstrategia(e) }))]
  const opcionesMadurez = [{ valor: TODOS, etiqueta: 'Toda madurez' }, ...opciones.madurez.map(m => ({ valor: m, etiqueta: resumirMadurez(m) }))]
  const opcionesModelos = [{ valor: TODOS, etiqueta: 'Todas las versiones' }, ...opciones.modelos.map(m => ({ valor: m, etiqueta: m }))]

  const columnas = [
    {
      campo: 'generadoEn',
      encabezado: 'Generado',
      render: r => <span className="whitespace-nowrap">{formatearFechaSegura(r.generadoEn)}</span>,
    },
    {
      campo: 'nombreProducto',
      encabezado: 'Producto',
      render: r => <span className="font-medium text-principal">{r.nombreProducto}</span>,
    },
    { campo: 'nombreBotica', encabezado: 'Botica' },
    { campo: 'horizonteResumen', encabezado: 'Horizonte' },
    {
      campo: 'demandaTotal',
      encabezado: 'Demanda pronosticada',
      render: r => <span>{formatearNumero(r.demandaTotal)} uds</span>,
    },
    {
      campo: 'estrategia',
      encabezado: 'Estrategia',
      render: r => <Insignia color="verde">{resumirEstrategia(r.estrategia)}</Insignia>,
    },
    {
      campo: 'nivelMadurez',
      encabezado: 'Madurez',
      render: r => <Insignia color="amarillo">{resumirMadurez(r.nivelMadurez)}</Insignia>,
    },
    {
      campo: 'modeloVersionId',
      encabezado: 'Modelo',
      render: r => <span className="font-mono text-xs">{r.modeloVersionId || '—'}</span>,
    },
    {
      campo: 'acciones',
      encabezado: 'Detalle',
      ordenable: false,
      render: r => <Boton variante="icono" icono={Eye} onClick={() => setDetalle(r)} title="Ver detalle" />,
    },
  ]

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando historial de predicciones...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Historial de Predicciones</h1>
          <p className="text-secundario mt-1">Consulta predicciones persistidas por ejecucion, estrategia, madurez y version del modelo.</p>
        </div>
        <Boton className="w-full sm:w-auto" variante="secundario" icono={RefreshCw} onClick={cargar}>Actualizar</Boton>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar el historial" mensaje={error} alCerrar={() => setError(null)} />}

      <div>
        <p className="text-secundario mb-3">{filas.length} predicciones encontradas</p>
        <BarraFiltros alLimpiar={limpiarFiltros}>
          <SelectBusquedaFiltro valor={filtros.boticaId === TODOS ? '' : filtros.boticaId} alCambiar={valor => actualizarFiltro('boticaId', valor || TODOS)} opciones={opcionesBoticas} placeholder="Todas las boticas" />
          <SelectBusquedaFiltro valor={filtros.productoId === TODOS ? '' : filtros.productoId} alCambiar={valor => actualizarFiltro('productoId', valor || TODOS)} opciones={opcionesProductos} placeholder="Todos los productos" className="sm:w-72" />
          <SelectFiltro valor={filtros.estrategia} alCambiar={valor => actualizarFiltro('estrategia', valor || TODOS)} opciones={opcionesEstrategias} placeholder="Todas las estrategias" />
          <SelectFiltro valor={filtros.madurez} alCambiar={valor => actualizarFiltro('madurez', valor || TODOS)} opciones={opcionesMadurez} placeholder="Toda madurez" />
          <SelectFiltro valor={filtros.modelo} alCambiar={valor => actualizarFiltro('modelo', valor || TODOS)} opciones={opcionesModelos} placeholder="Todas las versiones" />
        </BarraFiltros>
      </div>

      <Tabla columnas={columnas} datos={filas} tamanoPagina={12} mensajeVacio="Aun no existen predicciones registradas." />

      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de predicción" tamano="lg">
        {detalle && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-etiqueta text-secundario">Producto</p><p className="font-semibold text-principal">{detalle.nombreProducto}</p></div>
              <div><p className="text-etiqueta text-secundario">Botica</p><p className="font-semibold text-principal">{detalle.nombreBotica}</p></div>
              <div><p className="text-etiqueta text-secundario">Periodo</p><p className="font-semibold text-principal">{detalle.periodo}</p></div>
              <div><p className="text-etiqueta text-secundario">Generado en</p><p className="font-semibold text-principal">{formatearFechaSegura(detalle.generadoEn)}</p></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Demanda total</p><p className="text-h3 text-principal">{formatearNumero(detalle.demandaTotal)} uds</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Horizonte</p><p className="text-h3 text-principal">{detalle.horizonteResumen}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Rango esperado</p><p className="text-h3 text-principal">No disponible</p></div>
            </div>

            <Tabla
              columnas={[
                { campo: 'horizonte', encabezado: 'Semana' },
                { campo: 'periodo', encabezado: 'Periodo' },
                { campo: 'cantidadPredicha', encabezado: 'Cantidad pronosticada', render: r => `${formatearNumero(r.cantidadPredicha)} uds` },
                { campo: 'rango', encabezado: 'Rango esperado', render: r => formatearRango(r.intervaloInf, r.intervaloSup) },
                { campo: 'metodoAplicado', encabezado: 'Metodo aplicado' },
              ]}
              datos={detalle.predicciones.map(p => ({ ...p, periodo: `${formatearFechaSegura(p.periodoInicio)} - ${formatearFechaSegura(p.periodoFin)}` }))}
              busqueda={false}
              paginacion={false}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-etiqueta text-secundario">Estrategia</p><p className="font-semibold text-principal">{resumirEstrategia(detalle.estrategia)}</p></div>
              <div><p className="text-etiqueta text-secundario">Nivel de madurez</p><p className="font-semibold text-principal">{resumirMadurez(detalle.nivelMadurez)}</p></div>
              <div><p className="text-etiqueta text-secundario">Versión del modelo</p><p className="font-mono text-xs text-principal break-all">{detalle.modeloVersionId || '—'}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
