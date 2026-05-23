import { useState } from 'react'
import { Activity, Brain, RefreshCw, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import { metricasKPI } from '@/mock-data/metricasKPI'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const historialReentrenamiento = [
  { id: 1, fecha: '2026-05-15T03:00:00', version: 'v2.4.1', mape: 18.5, rmse: 12.3, estado: 'exito', duracion: '4m 32s' },
  { id: 2, fecha: '2026-05-08T03:00:00', version: 'v2.4.0', mape: 19.1, rmse: 12.8, estado: 'exito', duracion: '4m 15s' },
  { id: 3, fecha: '2026-05-01T03:00:00', version: 'v2.3.2', mape: 20.4, rmse: 13.5, estado: 'exito', duracion: '4m 48s' },
  { id: 4, fecha: '2026-04-24T03:00:00', version: 'v2.3.1', mape: 21.2, rmse: 14.1, estado: 'exito', duracion: '5m 02s' },
  { id: 5, fecha: '2026-04-17T03:00:00', version: 'v2.3.0', mape: 22.8, rmse: 15.0, estado: 'fallo', duracion: '2m 10s' },
  { id: 6, fecha: '2026-04-10T03:00:00', version: 'v2.2.1', mape: 23.5, rmse: 15.8, estado: 'exito', duracion: '4m 05s' },
]

const historialDrift = [
  { semana: 'Sem 17', psi: 0.12, estado: 'estable' },
  { semana: 'Sem 18', psi: 0.15, estado: 'estable' },
  { semana: 'Sem 19', psi: 0.22, estado: 'estable' },
  { semana: 'Sem 20', psi: 0.35, estado: 'critico' },
  { semana: 'Sem 21', psi: 0.18, estado: 'estable' },
  { semana: 'Sem 22', psi: 0.14, estado: 'estable' },
  { semana: 'Sem 23', psi: 0.11, estado: 'estable' },
  { semana: 'Sem 24', psi: 0.08, estado: 'estable' },
]

const ETIQUETAS_DRIFT = { estable: 'Estable', critico: 'Drift detectado' }
const COLORES_DRIFT = { estable: 'verde', critico: 'rojo' }

const datosTendenciaMAPE = metricasKPI.modelo.mape.tendencias.map(t => ({
  mes: t.fecha,
  mape: t.valor,
}))

const datosTendenciaNegocio = metricasKPI.negocio.fillRate.tendencias.map((t, i) => ({
  mes: t.fecha,
  fillRate: t.valor,
  tasaSobrestock: metricasKPI.negocio.tasaSobrestock.tendencias[i]?.valor || 0,
}))

export default function PaginaMonitoreoML() {
  const [reentrenando, setReentrenando] = useState(false)
  const [exito, setExito] = useState(null)

  const ultimoReentrenamiento = historialReentrenamiento[0]
  const ultimoDrift = historialDrift[historialDrift.length - 1]
  const driftActual = historialDrift.filter(d => d.estado === 'critico').length

  const manejarReentrenar = () => {
    setReentrenando(true)
    setTimeout(() => {
      setReentrenando(false)
      setExito('Reentrenamiento completado. MAPE: 18.2% (mejora de 0.3 pts)')
      setTimeout(() => setExito(null), 4000)
    }, 2500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Monitoreo del Modelo</h1>
          <p className="text-cuerpo text-secundario">Drift, métricas de rendimiento y reentrenamiento del modelo ML</p>
        </div>
        <Boton
          variante="primario"
          icono={RefreshCw}
          onClick={manejarReentrenar}
          cargando={reentrenando}
        >
          Reentrenar modelo
        </Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="MAPE Actual" valor={`${metricasKPI.modelo.mape.actual}%`} variacion={-2.1} icono={Brain} />
        <TarjetaMetrica etiqueta="RMSE" valor={`${metricasKPI.modelo.rmse.actual} uds`} icono={Activity} />
        <TarjetaMetrica etiqueta="MAE" valor={`${metricasKPI.modelo.mae.actual} uds`} icono={Activity} />
        <TarjetaMetrica etiqueta="PSI (Drift)" valor={ultimoDrift.psi.toFixed(2)} variacion={ultimoDrift.estado === 'critico' ? 100 : -30} icono={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Tendencia MAPE" descripcion="Evolución del error del modelo en holdout">
          <GraficaLinea
            datos={datosTendenciaMAPE}
            lineas={[{ clave: 'mape', etiqueta: 'MAPE (%)', color: '#107C41' }]}
            altura={220}
          />
        </Tarjeta>

        <Tarjeta titulo="Tendencia Fill Rate vs Sobrestock" descripcion="Métricas de negocio">
          <GraficaLinea
            datos={datosTendenciaNegocio}
            lineas={[
              { clave: 'fillRate', etiqueta: 'Fill Rate (%)', color: '#0078D4' },
              { clave: 'tasaSobrestock', etiqueta: 'Sobrestock (%)', color: '#C239B3' },
            ]}
            altura={220}
          />
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Monitoreo de Drift (PSI)" descripcion="Population Stability Index — umbral crítico: 0.30">
          <div className="space-y-3">
            {historialDrift.slice(-6).map(d => (
              <div key={d.semana} className="flex items-center gap-3 p-2 bg-fondo rounded-md">
                <span className="text-sm text-principal w-16">{d.semana}</span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      d.psi >= 0.30 ? 'bg-estado-critico' : d.psi >= 0.20 ? 'bg-estado-advertencia' : 'bg-marca-principal'
                    }`}
                    style={{ width: `${Math.min(d.psi / 0.5 * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-principal w-12 text-right">{d.psi.toFixed(2)}</span>
                <Insignia color={COLORES_DRIFT[d.estado]}>{ETIQUETAS_DRIFT[d.estado]}</Insignia>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Historial de Reentrenamiento"
          descripcion="Últimas ejecuciones del pipeline"
          accionDerecha={
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-secundario" />
              <span className="text-secundario">{formatearFechaRelativa(ultimoReentrenamiento.fecha)}</span>
            </div>
          }
        >
          <div className="space-y-2">
            {historialReentrenamiento.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 bg-fondo rounded-md">
                <div className="flex items-center gap-2">
                  {h.estado === 'exito'
                    ? <CheckCircle className="h-4 w-4 text-marca-principal" />
                    : <AlertTriangle className="h-4 w-4 text-estado-critico" />
                  }
                  <div>
                    <p className="text-sm text-principal">{h.version}</p>
                    <p className="text-xs text-secundario">{formatearFechaRelativa(h.fecha)} — {h.duracion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-principal">MAPE: {h.mape}%</p>
                  <p className="text-xs text-secundario">RMSE: {h.rmse}</p>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Resumen de Salud del Modelo">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-fondo rounded-lg border border-estilo">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-marca-principal" />
              <span className="text-sm font-semibold text-principal">Precisión</span>
            </div>
            <p className="text-h2 text-marca-principal">{metricasKPI.modelo.mape.actual}%</p>
            <p className="text-xs text-secundario mt-1">
              MAPE vs meta de {metricasKPI.modelo.mape.meta}% — {metricasKPI.modelo.mape.actual <= metricasKPI.modelo.mape.meta ? 'Cumpliendo objetivo' : 'Requiere mejora'}
            </p>
          </div>
          <div className="p-4 bg-fondo rounded-lg border border-estilo">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-estado-advertencia" />
              <span className="text-sm font-semibold text-principal">Drift</span>
            </div>
            <p className="text-h2 text-estado-advertencia">{driftActual > 0 ? `${driftActual} evento(s)` : '0'}</p>
            <p className="text-xs text-secundario mt-1">{driftActual > 0 ? 'Se detectó drift en las últimas semanas' : 'Sin drift detectado en las últimas 8 semanas'}</p>
          </div>
          <div className="p-4 bg-fondo rounded-lg border border-estilo">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-5 w-5 text-estado-info" />
              <span className="text-sm font-semibold text-principal">Reentrenamiento</span>
            </div>
            <p className="text-h2 text-estado-info">{historialReentrenamiento.length}</p>
            <p className="text-xs text-secundario mt-1">Entrenamientos ejecutados — Último: {ultimoReentrenamiento.version}</p>
          </div>
        </div>
      </Tarjeta>
    </div>
  )
}
