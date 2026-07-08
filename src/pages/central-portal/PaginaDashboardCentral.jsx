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

import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { obtenerEstadoModelo, obtenerMetricasModelo } from '@/services/ml-model/modelosML'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { listarVentasHistoricasImportadas } from '@/services/supabase/ventasHistoricas'
import { listarStockHistoricoImportado } from '@/services/supabase/stockHistorico'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'

const formatearPorcentaje = (valor) => valor == null ? 'N/D' : `${Number(valor).toFixed(2)}%`
const formatearDecimal = (valor) => valor == null || !Number.isFinite(Number(valor)) ? '—' : Number(valor).toFixed(2)

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
  const [alertas, setAlertas] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [estadoModelo, setEstadoModelo] = useState(null)
  const [predicciones, setPredicciones] = useState([])
  const [ventasHistoricas, setVentasHistoricas] = useState([])
  const [stockHistorico, setStockHistorico] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoFillRate, setCargandoFillRate] = useState(true)

  useEffect(() => {
    let cancelado = false

    Promise.allSettled([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      obtenerAlertas({ soloNoResueltas: true }),
      obtenerTransferencias(),
      obtenerPredicciones({ activos: true }).catch(() => []),
    ]).then((resultados) => {
      if (cancelado) return
      if (resultados[0].status === 'fulfilled') setStock(resultados[0].value)
      if (resultados[1].status === 'fulfilled') setProductos(resultados[1].value)
      if (resultados[2].status === 'fulfilled') setAlertas(resultados[2].value)
      if (resultados[3].status === 'fulfilled') setTransferencias(resultados[3].value)
      if (resultados[4].status === 'fulfilled') setPredicciones(resultados[4].value)
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
            {alertas.slice(0, 5).map(alerta => (
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
            {alertas.length === 0 && <p className="text-secundario text-sm text-center py-4">Sin alertas activas</p>}
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Métricas del Modelo ML" descripcion="Precisión del modelo predictivo">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaMetricaKPI etiqueta="MAPE" valor={formatearDecimal(estadoModelo?.mape)} valorEvaluacion={estadoModelo?.mape} meta={20} unidad="%" descripcion="Error porcentual absoluto medio del modelo" icono={Brain} tipo="modelo" />
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
      <Tarjeta titulo="Predicciones Destacadas" descripcion="Pronósticos generados por el modelo ML">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {predicciones.slice(0, 6).map(pred => (
            <div key={pred.id} className="p-4 bg-fondo border border-estilo rounded-lg">
                <p className="text-sm font-semibold text-principal">{pred.nombreProducto || pred.productoId || 'Producto'}</p>
                <p className="text-xs text-secundario">{pred.nombreBotica || pred.boticaId || '—'}</p>
                <div className="mt-3">
                <p className="text-lg sm:text-h2 text-marca-principal">{pred.cantidadPredicha ?? '—'} uds</p>
                <p className="text-xs text-secundario">
                  {(pred.intervaloInf || pred.intervaloSup)
                    ? `Rango esperado: ${formatearDecimal(pred.intervaloInf)} - ${formatearDecimal(pred.intervaloSup)} uds`
                    : `Confianza: ${formatearPorcentaje(pred.confianza != null && Number(pred.confianza) <= 1 ? Number(pred.confianza) * 100 : pred.confianza)}`}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Insignia color="verde">Producto: {pred.codigoProducto || pred.nombreProducto || 'Sin identificar'}</Insignia>
                <Insignia color="azul">Botica: {pred.nombreBotica || 'No especificada'}</Insignia>
              </div>
            </div>
          ))}
          {predicciones.length === 0 && <p className="text-secundario text-sm col-span-full text-center py-8">Sin predicciones disponibles</p>}
        </div>
      </Tarjeta>
    </div>
  )
}
