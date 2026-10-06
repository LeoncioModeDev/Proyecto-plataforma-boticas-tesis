import { useState, useEffect } from 'react'
import { Package, AlertTriangle, Boxes, Truck, Brain, PackageCheck, AlertOctagon } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import TarjetaMetricaKPI from '@/components/charts/TarjetaMetricaKPI'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'

import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerProductos } from '@/services/supabase/productos'
import { obtenerAlertas } from '@/services/supabase/alertas'
import { listarBoticas } from '@/services/supabase/boticas'

import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { obtenerEstadoModelo, obtenerMetricasModelo } from '@/services/ml-model/modelosML'
import { obtenerRecomendaciones } from '@/services/ml-model/recomendacionesML'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { listarVentasHistoricasImportadas } from '@/services/supabase/ventasHistoricas'
import { listarStockHistoricoImportado } from '@/services/supabase/stockHistorico'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'

const formatearPorcentaje = (valor) => valor == null ? 'N/D' : `${Number(valor).toFixed(2)}%`
const formatearDecimal = (valor) => valor == null || !Number.isFinite(Number(valor)) ? '—' : Number(valor).toFixed(2)

function etiquetaMadurez(valor) {
  const etiquetas = {
    MODELO_COMPLETO: 'Modelo completo',
    PREDICCION_LIMITADA: 'Predicción limitada',
    HISTORIAL_INTERMEDIO: 'Historial intermedio',
    HISTORIAL_INICIAL: 'Historial inicial',
    SIN_DATOS: 'Sin datos suficientes',
  }
  return etiquetas[valor] || valor || 'Madurez no disponible'
}

function etiquetaEstrategia(valor) {
  const etiquetas = {
    HIBRIDO_SARIMA_XGBOOST_ADAPTATIVO: 'SARIMA + XGBoost híbrido',
    XGBOOST_GLOBAL_CON_FEATURES_OFICIALES: 'XGBoost global',
    XGBOOST_GLOBAL_CON_FALLBACK_MADURO: 'XGBoost global',
    FALLBACK_OPERATIVO: 'Fallback operativo',
  }
  return etiquetas[valor] || valor || 'Estrategia no disponible'
}

function agruparPredicciones(predicciones, nombresProducto = {}, nombresBotica = {}) {
  const grupos = new Map()
  predicciones.forEach(pred => {
    const clave = [pred.generadoEn, pred.boticaId, pred.productoId, pred.modeloVersionId].join('|')
    const actual = grupos.get(clave) || { ...pred, demandaTotal: 0, semanas: 0 }
    actual.demandaTotal += Number(pred.cantidadPredicha || 0)
    actual.semanas += 1
    actual.nombreProducto = nombresProducto[pred.productoId] || pred.nombreProducto || 'Producto sin nombre'
    actual.nombreBotica = nombresBotica[pred.boticaId] || pred.nombreBotica || 'Botica sin nombre'
    grupos.set(clave, actual)
  })
  return [...grupos.values()].sort((a, b) => String(b.generadoEn || '').localeCompare(String(a.generadoEn || '')))
}

function resumenRecomendacionesPendientes(recomendaciones = []) {
  const pendientes = recomendaciones.filter(r => String(r.estado || '').toLowerCase() === 'pendiente')
  return {
    total: pendientes.length,
    reposiciones: pendientes.filter(r => String(r.tipo_recomendacion || r.tipo || '').includes('REPOSICION')).length,
    compras: pendientes.filter(r => String(r.tipo_recomendacion || r.tipo || '').includes('COMPRA')).length,
  }
}

function prioridadUrgencia(valor) {
  const v = String(valor || '').toLowerCase()
  if (v === 'critica' || v === 'alta') return 3
  if (v === 'media') return 2
  if (v === 'baja') return 1
  return 0
}

function obtenerMetricasHibridas(metricas = {}) {
  const metricasGlobales = metricas.metricas_globales || []
  const hibrido = metricasGlobales.find(m => {
    const modelo = String(m.modelo || '').replace(/_/g, ' ').toLowerCase()
    return modelo.includes('sarima') && modelo.includes('xgboost')
  }) || {}

  return {
    mape: metricas.macro_mape_hibrido ?? hibrido.MAPE ?? hibrido.mape ?? null,
    rmse: hibrido.RMSE ?? hibrido.rmse ?? null,
    mae: hibrido.MAE ?? hibrido.mae ?? null,
  }
}

function combinarEstadoYMetricas(estado = {}, metricas = {}) {
  const metricasHibridas = obtenerMetricasHibridas(metricas)
  return {
    ...estado,
    mape: estado.mape ?? metricasHibridas.mape,
    rmse: estado.rmse ?? metricasHibridas.rmse,
    mae: estado.mae ?? metricasHibridas.mae,
  }
}

function obtenerUltimaFechaComunHistorica(ventasHistoricas, stockHistorico) {
  const fechasVentas = new Set(ventasHistoricas.map(venta => venta.fecha_venta).filter(Boolean))
  const fechasStock = stockHistorico.map(item => item.fecha_snapshot).filter(Boolean)
  return fechasStock
    .filter(fecha => fechasVentas.has(fecha))
    .sort((a, b) => b.localeCompare(a))[0] || null
}

async function listarTodasLasPaginas(listar, filtros = {}) {
  const limite = 1000
  let pagina = 1
  let datos = []
  let total

  do {
    const respuesta = await listar({ ...filtros, pagina, limite })
    const paginaDatos = respuesta?.datos || []
    datos = datos.concat(paginaDatos)
    total = respuesta?.total ?? datos.length
    pagina += 1
    if (paginaDatos.length === 0) break
  } while (datos.length < total)

  return datos
}

async function cargarHistoricosRecientesOE3() {
  const stockReciente = await listarStockHistoricoImportado({
    limite: 1000,
    ordenCampo: 'fecha_snapshot',
    ascendente: false,
  })
  const stockDatos = stockReciente?.datos || []
  const fechasStock = [...new Set(stockDatos.map(item => item.fecha_snapshot).filter(Boolean))].sort()

  if (fechasStock.length === 0) return { ventas: [], stock: [] }

  const ventas = await listarTodasLasPaginas(listarVentasHistoricasImportadas, {
    fechaDesde: fechasStock[0],
    fechaHasta: fechasStock[fechasStock.length - 1],
    ordenCampo: 'fecha_venta',
    ascendente: true,
  })

  return { ventas, stock: stockDatos }
}

export default function PaginaDashboardCentral() {
  const [stock, setStock] = useState([])
  const [productos, setProductos] = useState([])
  const [boticas, setBoticas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [estadoModelo, setEstadoModelo] = useState(null)
  const [predicciones, setPredicciones] = useState([])
  const [recomendaciones, setRecomendaciones] = useState([])
  const [ventasHistoricas, setVentasHistoricas] = useState([])
  const [stockHistorico, setStockHistorico] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoFillRate, setCargandoFillRate] = useState(true)

  useEffect(() => {
    let cancelado = false

    Promise.allSettled([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      listarBoticas({ activas: true }),
      obtenerAlertas({ soloNoResueltas: true }),
      obtenerTransferencias(),
      obtenerPredicciones({ activos: true }).catch(() => []),
      obtenerRecomendaciones().catch(() => ({ recomendaciones: [] })),
    ]).then((resultados) => {
      if (cancelado) return
      if (resultados[0].status === 'fulfilled') setStock(resultados[0].value)
      if (resultados[1].status === 'fulfilled') setProductos(resultados[1].value)
      if (resultados[2].status === 'fulfilled') setBoticas(resultados[2].value)
      if (resultados[3].status === 'fulfilled') setAlertas(resultados[3].value)
      if (resultados[4].status === 'fulfilled') setTransferencias(resultados[4].value)
      if (resultados[5].status === 'fulfilled') setPredicciones(resultados[5].value)
      if (resultados[6].status === 'fulfilled') setRecomendaciones(resultados[6].value?.recomendaciones || [])
    }).finally(() => {
      if (!cancelado) setCargando(false)
    })

    // El estado del modelo y los historicos pueden tardar; no deben bloquear el dashboard inicial.
    Promise.allSettled([obtenerEstadoModelo(), obtenerMetricasModelo()])
      .then(([estadoResultado, metricasResultado]) => {
        if (cancelado) return
        const estado = estadoResultado.status === 'fulfilled' ? estadoResultado.value : {}
        const metricas = metricasResultado.status === 'fulfilled' ? metricasResultado.value : {}
        setEstadoModelo(combinarEstadoYMetricas(estado, metricas))
      })
      .catch(() => { if (!cancelado) setEstadoModelo(null) })

    cargarHistoricosRecientesOE3().then(({ ventas, stock }) => {
      if (cancelado) return
      setVentasHistoricas(ventas)
      setStockHistorico(stock)
    }).catch(() => {
      if (cancelado) return
      setVentasHistoricas([])
      setStockHistorico([])
    }).finally(() => {
      if (!cancelado) setCargandoFillRate(false)
    })

    return () => { cancelado = true }
  }, [])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando dashboard...</p></div>
  }

  const stockTotal = stock.reduce((acc, s) => acc + (s.cantidadDisponible || s.cantidad_total || 0), 0)
  const productosActivos = productos.length
  const alertasActivas = alertas.length
  const transferenciasEnTransito = transferencias.filter(t => t.estado === 'en_transito').length

  const fechaMetricasOE3 = obtenerUltimaFechaComunHistorica(ventasHistoricas, stockHistorico)
  const ventasOE3 = fechaMetricasOE3 ? ventasHistoricas.filter(venta => venta.fecha_venta === fechaMetricasOE3) : []
  const stockOE3 = fechaMetricasOE3 ? stockHistorico.filter(item => item.fecha_snapshot === fechaMetricasOE3) : []

  const demandaAtendida = ventasOE3.reduce((acc, venta) => acc + Number(venta.cantidad || 0), 0)
  const tieneDemandaInsatisfecha = stockOE3.some(item => Object.prototype.hasOwnProperty.call(item, 'demanda_insatisfecha'))
  const demandaInsatisfecha = stockOE3.reduce((acc, item) => acc + Number(item.demanda_insatisfecha || 0), 0)
  const demandaTotal = demandaAtendida + demandaInsatisfecha
  // Fill Rate OE3 = demanda atendida / demanda total del ultimo periodo historico comun; no es disponibilidad de stock.
  const fillRate = tieneDemandaInsatisfecha && demandaTotal > 0 ? (demandaAtendida / demandaTotal) * 100 : null

  const stockEvaluableSobrestock = stockOE3.filter(s => Number(s.stock_maximo) > 0)
  const sobrestockCount = stockEvaluableSobrestock.filter(s => Number(s.cantidad_disponible || 0) > Number(s.stock_maximo)).length
  // Tasa de sobrestock OE3 = snapshot historico sobre stock maximo / SKU-botica evaluables.
  const tasaSobrestock = stockEvaluableSobrestock.length > 0 ? (sobrestockCount / stockEvaluableSobrestock.length) * 100 : null

  const datosKPI = (() => {
    const fechasVentas = new Set(ventasHistoricas.map(venta => venta.fecha_venta).filter(Boolean))
    const fechasComunes = [...new Set(stockHistorico.map(item => item.fecha_snapshot).filter(Boolean))]
      .filter(fecha => fechasVentas.has(fecha))
      .sort()
      .slice(-8)

    return fechasComunes.map(fecha => {
      const ventasFecha = ventasHistoricas.filter(venta => venta.fecha_venta === fecha)
      const stockFecha = stockHistorico.filter(item => item.fecha_snapshot === fecha)
      const ventasTotal = ventasFecha.reduce((acc, venta) => acc + Number(venta.cantidad || 0), 0)
      const demandaNoAtendida = stockFecha.reduce((acc, item) => acc + Number(item.demanda_insatisfecha || 0), 0)
      const demandaFecha = ventasTotal + demandaNoAtendida
      const evaluables = stockFecha.filter(item => Number(item.stock_maximo) > 0)
      const sobrestock = evaluables.filter(item => Number(item.cantidad_disponible || 0) > Number(item.stock_maximo)).length

      return {
        mes: fecha,
        mape: estadoModelo?.mape != null ? Number(Number(estadoModelo.mape).toFixed(2)) : null,
        fillRate: demandaFecha > 0 ? Number(((ventasTotal / demandaFecha) * 100).toFixed(2)) : null,
        tasaSobrestock: evaluables.length > 0 ? Number(((sobrestock / evaluables.length) * 100).toFixed(2)) : null,
      }
    })
  })()

  const nombresProducto = Object.fromEntries(productos.map(p => [p.id, p.nombreComercial || p.nombre || p.id]))
  const nombresBotica = Object.fromEntries(boticas.map(b => [b.id, b.nombre || b.id]))
  const prediccionesDestacadas = agruparPredicciones(predicciones, nombresProducto, nombresBotica)
  const recomendacionesPendientes = resumenRecomendacionesPendientes(recomendaciones)
  const alertasPriorizadas = [...alertas]
    .filter(a => ['riesgo_desabastecimiento', 'stock_bajo', 'sobrestock', 'vencimiento'].includes(a.tipo))
    .sort((a, b) => prioridadUrgencia(b.urgencia) - prioridadUrgencia(a.urgencia))

  const datosTendencia = (() => {
    const agrupado = {}
    stockHistorico.forEach(item => {
      const fecha = item.fecha_snapshot
      if (!fecha) return
      if (!agrupado[fecha]) agrupado[fecha] = { mes: fecha, stock: 0 }
      agrupado[fecha].stock += Number(item.cantidad_disponible || 0)
    })
    return Object.values(agrupado).sort((a, b) => a.mes.localeCompare(b.mes))
  })()

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Dashboard</h1>
        <p className="text-sm sm:text-secundario text-secundario mt-1">Resumen general del sistema de inventario</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <TarjetaMetrica etiqueta="Stock Total" valor={formatearNumero(stockTotal)} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Activos" valor={productosActivos} icono={Package} />
        <TarjetaMetrica etiqueta="Alertas Activas" valor={alertasActivas} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={transferenciasEnTransito} icono={Truck} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Tarjeta titulo="Tendencia de Stock" className="lg:col-span-2">
          {datosTendencia.length > 0 ? (
            <GraficaLinea datos={datosTendencia} lineas={[{ clave: 'stock', etiqueta: 'Stock Total', color: '#107C41' }]} altura={280} />
          ) : (
            <p className="text-secundario text-sm text-center py-8">Sin datos de tendencia disponibles</p>
          )}
        </Tarjeta>
        <Tarjeta titulo="Alertas Recientes">
          <div className="space-y-3">
            {alertasPriorizadas.slice(0, 5).map(alerta => (
              <div key={alerta.id} className="flex items-start gap-3 p-3 bg-fondo rounded-md">
                <Insignia color={alerta.urgencia === 'alta' ? 'rojo' : alerta.urgencia === 'media' ? 'amarillo' : 'gris'}>
                  {alerta.tipo}
                </Insignia>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-principal line-clamp-2">{alerta.nombreProducto} - {alerta.nombreBotica}</p>
                  <p className="text-xs text-secundario mt-1">{formatearFechaRelativa(alerta.generadoEn)}</p>
                </div>
              </div>
            ))}
            {alertasPriorizadas.length === 0 && <p className="text-secundario text-sm text-center py-4">No existen alertas activas.</p>}
            {alertasPriorizadas.length > 0 && <a href="/ml/alertas" className="block text-sm text-marca-principal hover:underline text-center pt-2">Ver alertas</a>}
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Recomendaciones pendientes" descripcion="Decisiones operativas sugeridas por el modelo y el inventario">
        {recomendacionesPendientes.total > 0 ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Total pendientes</p><p className="text-h3 text-principal">{recomendacionesPendientes.total}</p></div>
              <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Reposiciones</p><p className="text-h3 text-principal">{recomendacionesPendientes.reposiciones}</p></div>
              <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Compras</p><p className="text-h3 text-principal">{recomendacionesPendientes.compras}</p></div>
            </div>
            <a href="/ml/recomendaciones" className="text-sm font-medium text-marca-principal hover:underline">Ver recomendaciones</a>
          </div>
        ) : (
          <p className="text-secundario text-sm text-center py-4">No existen recomendaciones pendientes.</p>
        )}
      </Tarjeta>
      <Tarjeta titulo="Modelo predictivo" descripcion="Estado del modelo de pronostico semanal de demanda">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Estado</p><p className="font-semibold text-principal">{estadoModelo?.modelo_pickle_cargado ? 'Activo' : 'No disponible'}</p></div>
          <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Version</p><p className="font-mono text-xs text-principal break-all">{estadoModelo?.version || '—'}</p></div>
          <div className="p-3 bg-fondo border border-estilo rounded-lg"><p className="text-etiqueta text-secundario">Entrenamiento</p><p className="font-semibold text-principal">{estadoModelo?.fecha_entrenamiento ? formatearFechaRelativa(estadoModelo.fecha_entrenamiento) : '—'}</p></div>
        </div>
        <p className="text-sm text-secundario mb-4">Metricas historicas de evaluacion del modelo. No representan el error especifico de una prediccion individual.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaMetricaKPI etiqueta="Macro-MAPE" valor={formatearDecimal(estadoModelo?.mape)} valorEvaluacion={estadoModelo?.mape} meta={20} unidad="%" descripcion="Evaluacion historica del modelo hibrido" icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="RMSE" valor={formatearDecimal(estadoModelo?.rmse)} unidad="uds" descripcion="Raíz del error cuadrático medio" icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="MAE" valor={formatearDecimal(estadoModelo?.mae)} unidad="uds" descripcion="Error absoluto medio" icono={Brain} tipo="modelo" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Métricas de Negocio" descripcion="Indicadores operativos OE3 de demanda y sobrestock">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TarjetaMetricaKPI etiqueta="Fill Rate" valor={cargandoFillRate ? 'Cargando...' : formatearPorcentaje(fillRate)} valorEvaluacion={fillRate} meta={85} unidad="" descripcion="Demanda atendida / demanda total" icono={PackageCheck} tipo="fillRate" />
          <TarjetaMetricaKPI etiqueta="Tasa de Sobrestock" valor={cargandoFillRate ? 'Cargando...' : formatearPorcentaje(tasaSobrestock)} valorEvaluacion={tasaSobrestock} meta={10} unidad="" descripcion="SKU-botica sobre stock máximo" icono={AlertOctagon} tipo="tasaSobrestock" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Tendencia de KPIs" descripcion="Evolución mensual de MAPE, Fill Rate y sobrestock">
        {datosKPI.length > 0 ? (
            <GraficaLinea datos={datosKPI} lineas={[
            { clave: 'mape', etiqueta: 'MAPE (%)', color: '#107C41' },
            { clave: 'fillRate', etiqueta: 'Fill Rate (%)', color: '#0078D4' },
            { clave: 'tasaSobrestock', etiqueta: 'Sobrestock (%)', color: '#C239B3' },
          ]} altura={200} />
        ) : (
          <p className="text-secundario text-sm text-center py-8">Sin datos históricos de KPIs disponibles</p>
        )}
      </Tarjeta>
      <Tarjeta titulo="Predicciones Destacadas" descripcion="Resumen de pronosticos persistidos; no ejecuta predicciones en vivo">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prediccionesDestacadas.slice(0, 6).map(pred => (
            <div key={`${pred.generadoEn}-${pred.boticaId}-${pred.productoId}`} className="p-4 bg-fondo border border-estilo rounded-lg">
                <p className="text-sm font-semibold text-principal">{pred.nombreProducto}</p>
                <p className="text-xs text-secundario">{pred.nombreBotica}</p>
                <div className="mt-3">
                <p className="text-lg sm:text-h2 text-marca-principal">{formatearDecimal(pred.demandaTotal)} unidades</p>
                <p className="text-xs text-secundario">Pronóstico para {pred.semanas} semanas · Promedio {formatearDecimal(pred.demandaTotal / Math.max(1, pred.semanas))} uds/semana</p>
                <p className="text-xs text-secundario mt-1">Generado {pred.generadoEn ? formatearFechaRelativa(pred.generadoEn) : 'sin fecha'}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Insignia color="verde">{etiquetaEstrategia(pred.estrategia)}</Insignia>
                <Insignia color="azul">{etiquetaMadurez(pred.nivelMadurez)}</Insignia>
              </div>
            </div>
          ))}
          {predicciones.length === 0 && <p className="text-secundario text-sm col-span-full text-center py-8">Sin predicciones disponibles</p>}
        </div>
      </Tarjeta>
    </div>
  )
}
