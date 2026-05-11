import { Package, AlertTriangle, Boxes, Truck, Brain, PackageCheck, AlertOctagon } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import TarjetaMetricaKPI from '@/components/charts/TarjetaMetricaKPI'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'

import { productos } from '@/mock-data/productos'
import { stock } from '@/mock-data/stock'
import { alertas } from '@/mock-data/alertas'
import { transferencias } from '@/mock-data/transferencias'
import { predicciones } from '@/mock-data/predicciones'
import { metricasKPI, HISTORIAL_KPI } from '@/mock-data/metricasKPI'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { COLORES_ALERTA, ETIQUETAS_ALERTA } from '@/constants/tiposAlerta'

export default function PaginaDashboardCentral() {
  const stockTotal = stock.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const productosActivos = productos.filter(p => p.estado === 'activo').length
  const alertasActivas = alertas.filter(a => !a.leida).length
  const transferenciasEnTransito = transferencias.filter(t => t.estado === 'en_transito').length

  const datosTendencia = [
    { mes: 'Oct', stock: 1100 }, { mes: 'Nov', stock: 1250 },
    { mes: 'Dic', stock: 1180 }, { mes: 'Ene', stock: 1320 },
    { mes: 'Feb', stock: 1280 }, { mes: 'Mar', stock: 1350 },
    { mes: 'Abr', stock: 1247 },
  ]

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
        <TarjetaMetrica etiqueta="Stock Total" valor={formatearNumero(stockTotal)} variacion={5.2} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Activos" valor={productosActivos} variacion={2.0} icono={Package} />
        <TarjetaMetrica etiqueta="Alertas Activas" valor={alertasActivas} variacion={-12.5} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={transferenciasEnTransito} icono={Truck} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Tarjeta titulo="Tendencia de Stock Total" className="lg:col-span-2">
          <GraficaLinea datos={datosTendencia} lineas={[{ clave: 'stock', etiqueta: 'Stock Total', color: '#107C41' }]} altura={280} />
        </Tarjeta>
        <Tarjeta titulo="Alertas Recientes">
          <div className="space-y-3">
            {alertas.filter(a => !a.leida).slice(0, 5).map(alerta => (
              <div key={alerta.id} className="flex items-start gap-3 p-3 bg-fondo rounded-md">
                <Insignia color={COLORES_ALERTA[alerta.tipo] || 'gris'}>{ETIQUETAS_ALERTA[alerta.tipo] || alerta.tipo}</Insignia>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-principal line-clamp-2">{alerta.mensaje}</p>
                  <p className="text-xs text-secundario mt-1">{formatearFechaRelativa(alerta.fechaCreacion)}</p>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Métricas del Modelo ML (OE3.I1)" descripcion="Precisión del modelo predictivo">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaMetricaKPI etiqueta="MAPE" valor={metricasKPI.modelo.mape.actual} meta={metricasKPI.modelo.mape.meta} unidad="%" descripcion={metricasKPI.modelo.mape.descripcion} icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="RMSE" valor={metricasKPI.modelo.rmse.actual} unidad={metricasKPI.modelo.rmse.unidad} descripcion={metricasKPI.modelo.rmse.descripcion} icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="MAE" valor={metricasKPI.modelo.mae.actual} unidad={metricasKPI.modelo.mae.unidad} descripcion={metricasKPI.modelo.mae.descripcion} icono={Brain} tipo="modelo" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Métricas de Negocio (OE3.I3)" descripcion="Indicadores de Fill Rate y Sobrestock">
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