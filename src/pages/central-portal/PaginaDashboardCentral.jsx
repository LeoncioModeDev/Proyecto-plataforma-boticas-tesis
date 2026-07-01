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
import { listarOrdenes } from '@/services/supabase/ordenesCompra'
import { obtenerEstadoModelo } from '@/services/ml-model/modelosML'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'

export default function PaginaDashboardCentral() {
  const [stock, setStock] = useState([])
  const [productos, setProductos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [estadoModelo, setEstadoModelo] = useState(null)
  const [predicciones, setPredicciones] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      obtenerAlertas({ soloNoResueltas: true }),
      obtenerMovimientos(),
      obtenerTransferencias(),
      listarOrdenes(),
      obtenerEstadoModelo().catch(() => null),
      obtenerPredicciones({ activos: true }).catch(() => []),
    ]).then((resultados) => {
      if (resultados[0].status === 'fulfilled') setStock(resultados[0].value)
      if (resultados[1].status === 'fulfilled') setProductos(resultados[1].value)
      if (resultados[2].status === 'fulfilled') setAlertas(resultados[2].value)
      if (resultados[3].status === 'fulfilled') setMovimientos(resultados[3].value)
      if (resultados[4].status === 'fulfilled') setTransferencias(resultados[4].value)
      if (resultados[5].status === 'fulfilled') setOrdenes(resultados[5].value)
      if (resultados[6].status === 'fulfilled') setEstadoModelo(resultados[6].value)
      if (resultados[7].status === 'fulfilled') setPredicciones(resultados[7].value)
    }).finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando dashboard...</p></div>
  }

  const stockTotal = stock.reduce((acc, s) => acc + (s.cantidadDisponible || s.cantidad_total || 0), 0)
  const productosActivos = productos.length
  const alertasActivas = alertas.length
  const transferenciasEnTransito = transferencias.filter(t => t.estado === 'en_transito').length

  const ordenesCompletadas = ordenes.filter(o => o.estado === 'recibida' || o.estado === 'recibida_parcial').length
  const fillRate = ordenes.length > 0 ? Math.round((ordenesCompletadas / ordenes.length) * 100) : null

  const sobrestockCount = stock.filter(s => (s.cantidadDisponible || 0) > 500).length
  const tasaSobrestock = stock.length > 0 ? Math.round((sobrestockCount / stock.length) * 100) : null

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
          <TarjetaMetricaKPI etiqueta="MAPE" valor={estadoModelo?.mape ?? '—'} meta={20} unidad="%" descripcion="Error porcentual absoluto medio del modelo" icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="RMSE" valor={estadoModelo?.rmse ?? '—'} unidad="uds" descripcion="Raíz del error cuadrático medio" icono={Brain} tipo="modelo" />
          <TarjetaMetricaKPI etiqueta="MAE" valor={estadoModelo?.mae ?? '—'} unidad="uds" descripcion="Error absoluto medio" icono={Brain} tipo="modelo" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Métricas de Negocio" descripcion="Indicadores de Fill Rate y Sobrestock">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TarjetaMetricaKPI etiqueta="Fill Rate" valor={fillRate ?? '—'} meta={90} unidad="%" descripcion="Órdenes de compra recibidas vs. totales" icono={PackageCheck} tipo="fillRate" />
          <TarjetaMetricaKPI etiqueta="Tasa de Sobrestock" valor={tasaSobrestock ?? '—'} meta={10} unidad="%" descripcion="Productos con stock excesivo sobre el total" icono={AlertOctagon} tipo="sobrestock" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Tendencia de KPIs" descripcion="Evolución mensual de MAPE, Fill Rate y Tasa de Sobrestock">
        {predicciones.length > 0 ? (
          <GraficaLinea datos={predicciones.slice(0, 12).map((p, i) => ({
            mes: `P-${i + 1}`,
            mape: p.confianza ? (100 - p.confianza) : null,
            fillRate: null,
            tasaSobrestock: null,
          }))} lineas={[
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
              <p className="text-sm font-semibold text-principal">{pred.nombreProducto || 'Producto'}</p>
              <p className="text-xs text-secundario">{pred.nombreBotica || pred.botica || '—'}</p>
              <div className="mt-3">
                <p className="text-lg sm:text-h2 text-marca-principal">{pred.cantidad_pronosticada ?? pred.demanda_estimada ?? '—'} uds</p>
                <p className="text-xs text-secundario">
                  {(pred.intervalo_inf || pred.intervalo_sup) ? `Rango: ${pred.intervalo_inf ?? '?'} — ${pred.intervalo_sup ?? '?'}` : `Confianza: ${pred.confianza ?? '—'}%`}
                </p>
              </div>
              {pred.producto_id && <div className="mt-2"><Insignia color="verde">ID: {pred.producto_id}</Insignia></div>}
            </div>
          ))}
          {predicciones.length === 0 && <p className="text-secundario text-sm col-span-full text-center py-8">Sin predicciones disponibles</p>}
        </div>
      </Tarjeta>
    </div>
  )
}
