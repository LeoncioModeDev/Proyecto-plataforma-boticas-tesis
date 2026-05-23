import { useState } from 'react'
import { Cpu, Save, Globe, Key, Database, RefreshCw } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'

export default function PaginaConfiguracionAvanzada() {
  const [config, setConfig] = useState({
    apiUrl: 'https://api.boticaml.pe/v1',
    apiTimeout: 30000,
    mlServiceUrl: 'https://ml.boticaml.pe/api',
    mlModelVersion: 'SARIMA+XGBoost v2.4.1',
    mlAutoRetrain: true,
    mlRetrainInterval: '7',
    dbPoolSize: 20,
    dbMaxConnections: 50,
    cacheEnabled: true,
    cacheTtl: 300,
    rateLimitEnabled: true,
    rateLimitMax: 100,
    rateLimitWindow: 60,
    featurePredicciones: true,
    featureAlertasML: true,
    featureRecomendaciones: true,
    featureMonitoreo: true,
    modoMantenimiento: false,
  })

  const [guardado, setGuardado] = useState(false)

  const manejarCambio = (campo, valor) => {
    setConfig(prev => ({ ...prev, [campo]: valor }))
  }

  const guardarConfig = () => {
    console.log('[Mock] Config avanzada guardada:', config)
    setGuardado(true)
    setTimeout(() => setGuardado(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-h1 text-principal">Configuración Avanzada</h1>
        <p className="text-cuerpo text-secundario mt-1">Parámetros técnicos, integraciones y opciones avanzadas del sistema</p>
      </div>

      {guardado && <Alerta tipo="exito" titulo="Configuración avanzada guardada correctamente" />}

      <Tarjeta titulo="API y Servicios" icono={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">URL Base API</label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={e => manejarCambio('apiUrl', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal font-mono focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Timeout API (ms)</label>
            <input
              type="number"
              value={config.apiTimeout}
              onChange={e => manejarCambio('apiTimeout', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">URL Servicio ML</label>
            <input
              type="text"
              value={config.mlServiceUrl}
              onChange={e => manejarCambio('mlServiceUrl', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal font-mono focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Versión del Modelo</label>
            <input
              type="text"
              value={config.mlModelVersion}
              onChange={e => manejarCambio('mlModelVersion', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Machine Learning" icono={Cpu}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.mlAutoRetrain}
              onChange={e => manejarCambio('mlAutoRetrain', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Reentrenamiento Automático</p>
              <p className="text-xs text-secundario">Ejecutar reentrenamiento del modelo periódicamente</p>
            </div>
          </label>
          {config.mlAutoRetrain && (
            <div className="flex flex-col gap-1.5 max-w-xs ml-8">
              <label className="text-sm font-medium text-principal">Intervalo (días)</label>
              <select
                value={config.mlRetrainInterval}
                onChange={e => manejarCambio('mlRetrainInterval', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              >
                <option value="1">Cada día</option>
                <option value="7">Cada 7 días</option>
                <option value="14">Cada 14 días</option>
                <option value="30">Cada 30 días</option>
              </select>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Base de Datos" icono={Database}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Pool de Conexiones</label>
            <input
              type="number"
              value={config.dbPoolSize}
              onChange={e => manejarCambio('dbPoolSize', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Máx. Conexiones</label>
            <input
              type="number"
              value={config.dbMaxConnections}
              onChange={e => manejarCambio('dbMaxConnections', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Cache y Rate Limiting" icono={RefreshCw}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.cacheEnabled}
              onChange={e => manejarCambio('cacheEnabled', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Cache Habilitado</p>
              <p className="text-xs text-secundario">Almacenar en caché consultas frecuentes</p>
            </div>
          </label>
          {config.cacheEnabled && (
            <div className="flex flex-col gap-1.5 max-w-xs ml-8">
              <label className="text-sm font-medium text-principal">TTL de Cache (segundos)</label>
              <input
                type="number"
                value={config.cacheTtl}
                onChange={e => manejarCambio('cacheTtl', Number(e.target.value))}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              />
            </div>
          )}
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.rateLimitEnabled}
              onChange={e => manejarCambio('rateLimitEnabled', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Rate Limiting</p>
              <p className="text-xs text-secundario">Limitar peticiones por ventana de tiempo</p>
            </div>
          </label>
          {config.rateLimitEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-principal">Máx. Peticiones</label>
                <input
                  type="number"
                  value={config.rateLimitMax}
                  onChange={e => manejarCambio('rateLimitMax', Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-principal">Ventana (segundos)</label>
                <input
                  type="number"
                  value={config.rateLimitWindow}
                  onChange={e => manejarCambio('rateLimitWindow', Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                />
              </div>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Feature Flags" icono={Key}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.featurePredicciones}
              onChange={e => manejarCambio('featurePredicciones', e.target.checked)}
              className="rounded border-estilo"
            />
            <span className="text-sm text-principal">Predicciones ML</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.featureAlertasML}
              onChange={e => manejarCambio('featureAlertasML', e.target.checked)}
              className="rounded border-estilo"
            />
            <span className="text-sm text-principal">Alertas ML</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.featureRecomendaciones}
              onChange={e => manejarCambio('featureRecomendaciones', e.target.checked)}
              className="rounded border-estilo"
            />
            <span className="text-sm text-principal">Recomendaciones</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.featureMonitoreo}
              onChange={e => manejarCambio('featureMonitoreo', e.target.checked)}
              className="rounded border-estilo"
            />
            <span className="text-sm text-principal">Monitoreo ML</span>
          </label>
        </div>
        <div className="mt-4 pt-4 border-t border-estilo">
          <label className="flex items-center gap-3 p-3 bg-estado-critico-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.modoMantenimiento}
              onChange={e => manejarCambio('modoMantenimiento', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-estado-critico">Modo Mantenimiento</p>
              <p className="text-xs text-estado-critico">Solo administradores pueden acceder al sistema</p>
            </div>
          </label>
        </div>
      </Tarjeta>

      <div className="flex justify-end pt-4">
        <Boton variante="primario" icono={Save} onClick={guardarConfig}>Guardar Configuración</Boton>
      </div>
    </div>
  )
}
