import { useState, useEffect } from 'react'
import { Cpu, CalendarClock, BrainCircuit, AlertCircle, Database, TrendingUp, Gauge, Target } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import useConfiguracion from '@/state/useConfiguracion'
import { obtenerModeloActivo } from '@/services/supabase/modelosML'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const NOMBRES_ALGORITMO = {
  sarima_xgboost: 'SARIMA + XGBoost',
  prophet: 'Prophet',
  lstm: 'LSTM',
}

const INTERVALOS_REENTRENAMIENTO = {
  30: 'Cada 30 días',
  60: 'Cada 60 días',
  90: 'Cada 90 días',
  180: 'Cada 180 días',
}

function MetricaIcono({ children, icono: Icono, label }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-fondo rounded-lg">
      <Icono className="h-5 w-5 text-marca-principal shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-secundario">{label}</p>
        <p className="text-sm font-semibold text-principal">{children}</p>
      </div>
    </div>
  )
}

export default function PaginaConfiguracionAvanzada() {
  const { config, cargando: configCargando, error: configError, cargarConfig } = useConfiguracion()
  const [modelo, setModelo] = useState(null)
  const [cargandoModelo, setCargandoModelo] = useState(true)

  useEffect(() => {
    cargarConfig()
  }, [cargarConfig])

  useEffect(() => {
    obtenerModeloActivo()
      .then(setModelo)
      .catch(() => setModelo(null))
      .finally(() => setCargandoModelo(false))
  }, [])

  const cargando = configCargando && !config
  const error = configError

  if (cargando) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-h1 text-principal">Configuración Avanzada</h1>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-marca-principal border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!config && !cargando) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-h1 text-principal">Configuración Avanzada</h1>
        <Alerta tipo="error" titulo={error || 'No se pudo cargar la configuración'} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-h1 text-principal">Configuración Avanzada</h1>
        <p className="text-cuerpo text-secundario mt-1">Parámetros del pipeline de Machine Learning — solo lectura</p>
      </div>

      <Tarjeta titulo="Pipeline ML" icono={BrainCircuit}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Estado del Pipeline</span>
              <span className={`text-sm font-semibold ${config.pipelineActivo ? 'text-estado-exito' : 'text-secundario'}`}>
                {config.pipelineActivo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Snapshot Automático</span>
              <span className={`text-sm font-semibold ${config.snapshotAutomatico ? 'text-estado-exito' : 'text-secundario'}`}>
                {config.snapshotAutomatico ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Algoritmo de Predicción</span>
              <span className="text-sm text-principal">{NOMBRES_ALGORITMO[config.algoritmoPrediccion] || config.algoritmoPrediccion}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Días de Historial</span>
              <span className="text-sm text-principal">{config.diasHistorialPrediccion} días</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Umbral MAPE Máximo</span>
              <span className="text-sm text-principal">{config.umbralMapeMaximo}%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secundario uppercase tracking-wider">Reentrenamiento</span>
              <span className="text-sm text-principal">{INTERVALOS_REENTRENAMIENTO[config.frecuenciaReentrenamientoDias] || `Cada ${config.frecuenciaReentrenamientoDias} días`}</span>
            </div>
          </div>

          {(config.datosDesde || config.datosHasta) && (
            <div className="border-t border-estilo pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secundario uppercase tracking-wider">Datos Desde</span>
                  <span className="text-sm text-principal">{config.datosDesde || '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secundario uppercase tracking-wider">Datos Hasta</span>
                  <span className="text-sm text-principal">{config.datosHasta || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Modelo en Producción" icono={Database}>
        {cargandoModelo ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-marca-principal border-t-transparent rounded-full" />
          </div>
        ) : modelo ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <MetricaIcono icono={Cpu} label="Versión">{modelo.version}</MetricaIcono>
              <MetricaIcono icono={BrainCircuit} label="Algoritmo">{NOMBRES_ALGORITMO[modelo.algoritmo] || modelo.algoritmo}</MetricaIcono>
              <MetricaIcono icono={CalendarClock} label="Entrenamiento">{formatearFechaCorta(modelo.fecha_entrenamiento)}</MetricaIcono>
              <MetricaIcono icono={Target} label="Estado">{modelo.status === 'production' ? 'Producción' : modelo.status}</MetricaIcono>
            </div>

            <div className="border-t border-estilo pt-4">
              <p className="text-xs font-medium text-secundario uppercase tracking-wider mb-3">Métricas de Precisión</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricaIcono icono={Gauge} label="MAE">
                  {modelo.mae != null ? Number(modelo.mae).toFixed(4) : '—'}
                </MetricaIcono>
                <MetricaIcono icono={TrendingUp} label="RMSE">
                  {modelo.rmse != null ? Number(modelo.rmse).toFixed(4) : '—'}
                </MetricaIcono>
                <MetricaIcono icono={AlertCircle} label="MAPE">
                  {modelo.mape != null ? `${Number(modelo.mape).toFixed(2)}%` : '—'}
                </MetricaIcono>
              </div>
            </div>

            <div className="border-t border-estilo pt-4">
              <p className="text-xs font-medium text-secundario uppercase tracking-wider mb-3">Rango de Datos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricaIcono icono={Database} label="Desde">{formatearFechaCorta(modelo.datos_desde)}</MetricaIcono>
                <MetricaIcono icono={Database} label="Hasta">{formatearFechaCorta(modelo.datos_hasta)}</MetricaIcono>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Cpu className="h-10 w-10 text-secundario mb-3" />
            <p className="text-cuerpo text-principal font-medium">Sin modelo en producción</p>
            <p className="text-etiqueta text-secundario mt-1 max-w-md">
              No hay un modelo ML activo desplegado. Los resultados de predicción no estarán disponibles hasta que se entrene y promocione un modelo.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Ejecuciones del Pipeline" icono={CalendarClock}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-secundario mb-3" />
          <p className="text-cuerpo text-principal font-medium">Sin ejecuciones registradas</p>
          <p className="text-etiqueta text-secundario mt-1">
            {config.pipelineActivo
              ? 'El pipeline se ejecutará según la frecuencia de reentrenamiento configurada'
              : 'Active el pipeline desde la configuración del sistema para comenzar'}
          </p>
        </div>
      </Tarjeta>
    </div>
  )
}
