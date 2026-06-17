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
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { metricasKPI, HISTORIAL_KPI } from '@/mock-data/metricasKPI'
import { predicciones } from '@/mock-data/predicciones'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'

export default function PaginaDashboardCentral() {
  const [stock, setStock] = useState([])
  const [productos, setProductos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      obtenerAlertas({ soloNoResueltas: true }),
      obtenerMovimientos(),
      obtenerTransferencias(),
    ]).then(([stockData, prodData, alertasData, movData, transData]) => {
      setStock(stockData)
      setProductos(prodData)
      setAlertas(alertasData)
      setMovimientos(movData)
      setTransferencias(transData)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando dashboard...</p></div>
  }

  const stockTotal = stock.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const productosActivos = productos.length
  const alertasActivas = alertas.length
  const transferenciasEnTransito = transferencias.filter(t => t.estado === 'en_transito').length

  const datosTendencia = (() => {
    const agrupado = {}
    movimientos.forEach(m => {
      const mes = m.createdAt?.substring(0, 7)
      if (!mes) return
      if (!agrupado[mes]) agrupado[mes] = { mes, stock: 0 }
      if (m.tipo === 'entrada') agrupado[mes].stock += m.cantidad
      if (m.tipo === 'salida') agrupado[mes].stock -= Math.abs(m.cantidad)
    })
    return Object.values(agrupado).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-7)
  })()

  const datosKPIs = HISTORIAL_KPI.map(h => ({
    mes: h.mes,
    mape: h.mape,
    fillRate: h.fillRate,
    tasaSobrestock: h.tasaSobrestock,
  }))

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Dashboard</h1>
        <p className="text-sm sm:text-secundario text-secundario mt-1">Resumen general del sistema de inventario</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
          <TarjetaMetricaKPI etiqueta="MAPE" valor={metricasKPI.modelo.mape.actual} meta={metricasKPI.modelo.mape.meta} unidad="%" descripcion={metricasKPI.modelo.mape.descripcion} icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="RMSE" valor={metricasKPI.modelo.rmse.actual} unidad={metricasKPI.modelo.rmse.unidad} descripcion={metricasKPI.modelo.rmse.descripcion} icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="MAE" valor={metricasKPI.modelo.mae.actual} unidad={metricasKPI.modelo.mae.unidad} descripcion={metricasKPI.modelo.mae.descripcion} icono={Brain} tipo="modelo" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Métricas de Negocio" descripcion="Indicadores de Fill Rate y Sobrestock">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TarjetaMetricaKPI etiqueta="Fill Rate" valor={metricasKPI.negocio.fillRate.actual} meta={metricasKPI.negocio.fillRate.meta} unidad="%" descripcion={metricasKPI.negocio.fillRate.descripcion} icono={PackageCheck} tipo="fillRate" />
          <TarjetaMetricaKPI etiqueta="Tasa de Sobrestock" valor={metricasKPI.negocio.tasaSobrestock.actual} meta={metricasKPI.negocio.tasaSobrestock.meta} unidad="%" descripcion={metricasKPI.negocio.tasaSobrestock.descripcion} icono={AlertOctagon} tipo="sobrestock" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Tendencia de KPIs" descripcion="Evolución mensual de MAPE, Fill Rate y Tasa de Sobrestock">
        <GraficaLinea datos={datosKPIs} lineas={[
          { clave: 'mape', etiqueta: 'MAPE (%)', color: '#107C41' },
          { clave: 'fillRate', etiqueta: 'Fill Rate (%)', color: '#0078D4' },
          { clave: 'tasaSobrestock', etiqueta: 'Sobrestock (%)', color: '#C239B3' },
        ]} altura={200} />
      </Tarjeta>
      <Tarjeta titulo="Predicciones Destacadas" descripcion="Pronósticos del modelo SARIMA + XGBoost">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {predicciones.slice(0, 3).map(pred => (
            <div key={pred.id} className="p-4 bg-fondo border border-estilo rounded-lg">
              <p className="text-sm font-semibold text-principal">{pred.nombreProducto}</p>
              <p className="text-xs text-secundario">{pred.nombreBotica}</p>
              <div className="mt-3">
                <p className="text-lg sm:text-h2 text-marca-principal">{pred.pronostico[0]?.predicho} uds</p>
                <p className="text-xs text-secundario">Rango: {pred.pronostico[0]?.intervaloInf} — {pred.pronostico[0]?.intervaloSup}</p>
              </div>
              <div className="mt-2"><Insignia color="verde">MAPE: {pred.metricas.mape}%</Insignia></div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  )
}
