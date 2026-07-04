import { useState, useEffect } from 'react'
import { Activity, Brain, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'
import { obtenerEstadoModelo, obtenerMetricasModelo } from '@/services/ml-model/modelosML'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

export default function PaginaMonitoreoML() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState(null)
  const [metricas, setMetricas] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const [estadoData, metricasData] = await Promise.all([
          obtenerEstadoModelo(),
          obtenerMetricasModelo(),
        ])
        setEstado(estadoData)
        setMetricas(metricasData)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-marca-principal" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-estado-critico mb-4" />
        <p className="text-cuerpo text-estado-critico">Error al conectar con el modelo ML</p>
        <p className="text-sm text-secundario mt-1">{error}</p>
      </div>
    )
  }

  const mape = estado?.mape ?? metricas?.mape
  const rmse = estado?.rmse ?? metricas?.rmse
  const mae = estado?.mae ?? metricas?.mae
  const psi = estado?.psi
  const drift = estado?.estado_drift || {}
  const version = estado?.version || '—'
  const modo = estado?.modo || '—'
  const fechaCarga = estado?.fecha_carga
  const fechaEntrenamiento = estado?.fecha_entrenamiento
  const seriesSarima = estado?.series_sarima ?? 0
  const seriesFallback = estado?.series_fallback ?? 0
  const totalPredicciones = estado?.total_predicciones ?? 0
  const ultimaInferencia = estado?.ultima_inferencia

  const historialDrift = psi != null
    ? [
        { semana: 'Actual', psi: typeof psi === 'number' ? psi : 0, estado: drift.alerta_critica ? 'critico' : 'estable' },
      ]
    : []

  const ultimoDrift = historialDrift[historialDrift.length - 1] || { psi: 0, estado: 'estable' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Monitoreo del Modelo</h1>
          <p className="text-cuerpo text-secundario">Drift, métricas de rendimiento y reentrenamiento del modelo ML</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="MAPE Actual" valor={mape != null ? `${mape}%` : '—'} variacion={mape != null ? -2.1 : null} icono={Brain} />
        <TarjetaMetrica etiqueta="RMSE" valor={rmse != null ? `${rmse} uds` : '—'} icono={Activity} />
        <TarjetaMetrica etiqueta="MAE" valor={mae != null ? `${mae} uds` : '—'} icono={Activity} />
        <TarjetaMetrica etiqueta="PSI (Drift)" valor={psi != null ? psi.toFixed(2) : '—'} variacion={ultimoDrift.estado === 'critico' ? 100 : null} icono={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Tendencia MAPE" descripcion="Evolución del error del modelo en holdout">
          {mape != null ? (
            <GraficaLinea
              datos={[{ mes: 'Actual', mape }]}
              lineas={[{ clave: 'mape', etiqueta: 'MAPE (%)', color: '#107C41' }]}
              altura={220}
            />
          ) : (
            <p className="text-secundario text-sm py-8 text-center">Sin datos históricos de MAPE</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Información del Modelo" descripcion="Versión y modo de operación">
          <div className="space-y-3">
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Versión</span>
              <span className="text-sm font-mono text-principal">{version}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Modo</span>
              <span className="text-sm text-principal">{modo}</span>
            </div>
            {fechaCarga && (
              <div className="flex justify-between p-2 bg-fondo rounded-md">
                <span className="text-sm text-principal">Última carga</span>
                <span className="text-sm text-principal">{formatearFechaRelativa(fechaCarga)}</span>
              </div>
            )}
            {fechaEntrenamiento && (
              <div className="flex justify-between p-2 bg-fondo rounded-md">
                <span className="text-sm text-principal">Fecha entrenamiento</span>
                <span className="text-sm text-principal">{formatearFechaRelativa(fechaEntrenamiento)}</span>
              </div>
            )}
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Modelo cargado</span>
              <span className="text-sm text-principal">{estado?.modelo_pickle_cargado ? 'Sí' : 'No'}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Series SARIMA</span>
              <span className="text-sm text-principal">{seriesSarima}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Series Fallback</span>
              <span className="text-sm text-principal">{seriesFallback}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Total predicciones cargadas</span>
              <span className="text-sm text-principal">{totalPredicciones}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Última inferencia</span>
              <span className="text-sm text-principal">{ultimaInferencia ? formatearFechaRelativa(ultimaInferencia) : 'Sin datos'}</span>
            </div>
          </div>
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Monitoreo de Drift (PSI)" descripcion="Population Stability Index — umbral crítico: 0.30">
          {historialDrift.length > 0 ? (
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
                  <Insignia color={d.estado === 'critico' ? 'rojo' : 'verde'}>{d.estado === 'critico' ? 'Drift detectado' : 'Estable'}</Insignia>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secundario text-sm py-8 text-center">Sin datos de drift disponibles</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Salud del Pipeline" descripcion="Estado general del modelo ML">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-fondo rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-4 w-4 ${drift.requiere_retraining ? 'text-estado-advertencia' : 'text-marca-principal'}`} />
                <span className="text-sm text-principal">Requiere retraining</span>
              </div>
              <span className="text-sm text-principal">{drift.requiere_retraining ? 'Sí' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-fondo rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${drift.alerta_critica ? 'text-estado-critico' : 'text-marca-principal'}`} />
                <span className="text-sm text-principal">Alerta crítica</span>
              </div>
              <span className="text-sm text-principal">{drift.alerta_critica ? 'Sí' : 'No'}</span>
            </div>
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}
