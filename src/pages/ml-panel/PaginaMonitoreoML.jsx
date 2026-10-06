import { useState, useEffect } from 'react'
import { Activity, Brain, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'
import { obtenerDriftModelo, obtenerEstadoModelo, obtenerMetricasModelo } from '@/services/ml-model/modelosML'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

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

export default function PaginaMonitoreoML() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState(null)
  const [metricas, setMetricas] = useState(null)
  const [driftModelo, setDriftModelo] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const [estadoData, metricasData, driftData] = await Promise.all([
          obtenerEstadoModelo(),
          obtenerMetricasModelo(),
          obtenerDriftModelo(),
        ])
        setEstado(estadoData)
        setMetricas(metricasData)
        setDriftModelo(driftData)
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
        <p className="text-cuerpo text-estado-critico">Error al conectar con el servicio predictivo</p>
        <p className="text-sm text-secundario mt-1">{error}</p>
      </div>
    )
  }

  const metricasHibridas = obtenerMetricasHibridas(metricas || {})
  const mape = estado?.mape ?? metricasHibridas.mape
  const rmse = estado?.rmse ?? metricasHibridas.rmse
  const mae = estado?.mae ?? metricasHibridas.mae
  const psi = estado?.psi
  const drift = driftModelo || estado?.estado_drift || {}
  const version = estado?.version || '—'
  const modo = estado?.modo || '—'
  const fechaCarga = estado?.fecha_carga
  const fechaEntrenamiento = estado?.fecha_entrenamiento
  const ordenesSarima = estado?.ordenes_sarima
  const categoriasAdaptativas = estado?.categorias_adaptativas
  const featuresXgboost = estado?.features_xgboost
  const featuresHibrido = estado?.features_hibrido
  const totalPredicciones = estado?.total_predicciones ?? 0
  const ultimaInferencia = estado?.ultima_inferencia

  const historialDrift = psi != null
    ? [
        { semana: 'Actual', psi: Number.isFinite(Number(psi)) ? Number(Number(psi).toFixed(2)) : 0, estado: drift.alerta_critica ? 'critico' : 'estable' },
      ]
    : []

  const ultimoDrift = historialDrift[historialDrift.length - 1] || { psi: 0, estado: 'estable' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Monitoreo del Modelo</h1>
          <p className="text-cuerpo text-secundario">Estado, evaluacion historica y metadatos del modelo de demanda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Macro-MAPE historico" valor={mape != null ? `${formatearDecimal(mape)}%` : '—'} icono={Brain} />
        <TarjetaMetrica etiqueta="RMSE" valor={rmse != null ? `${formatearDecimal(rmse)} uds` : '—'} icono={Activity} />
        <TarjetaMetrica etiqueta="MAE" valor={mae != null ? `${formatearDecimal(mae)} uds` : '—'} icono={Activity} />
        <TarjetaMetrica etiqueta="PSI (Drift)" valor={psi != null ? psi.toFixed(2) : '—'} variacion={ultimoDrift.estado === 'critico' ? 100 : null} icono={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Métricas históricas de evaluación" descripcion="Metricas obtenidas durante la evaluacion del modelo; no representan el error de una prediccion individual">
          {mape != null ? (
            <GraficaLinea
              datos={[{ mes: 'Actual', mape: Number(Number(mape).toFixed(2)) }]}
              lineas={[{ clave: 'mape', etiqueta: 'Macro-MAPE (%)', color: '#107C41' }]}
              altura={220}
            />
          ) : (
            <p className="text-secundario text-sm py-8 text-center">No hay informacion disponible para esta metrica.</p>
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
              <span className="text-sm text-principal">Ordenes SARIMA</span>
              <span className="text-sm text-principal">{ordenesSarima ?? '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Categorias adaptativas</span>
              <span className="text-sm text-principal">{categoriasAdaptativas ?? '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Features XGBoost</span>
              <span className="text-sm text-principal">{featuresXgboost ?? '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-fondo rounded-md">
              <span className="text-sm text-principal">Features hibrido</span>
              <span className="text-sm text-principal">{featuresHibrido ?? '—'}</span>
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

        <Tarjeta titulo="Salud del Pipeline" descripcion="Estado general del servicio predictivo">
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
