import { useState } from 'react'
import { Save, Building2, Bell, Shield } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'

const OPCIONES_ZONA_HORARIA = [
  { valor: 'America/Lima', etiqueta: 'Lima (UTC-5)' },
  { valor: 'America/Bogota', etiqueta: 'Bogotá (UTC-5)' },
  { valor: 'America/Mexico_City', etiqueta: 'Ciudad de México (UTC-6)' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Buenos Aires (UTC-3)' },
  { valor: 'America/Santiago', etiqueta: 'Santiago (UTC-4)' },
  { valor: 'UTC', etiqueta: 'UTC' },
]

const OPCIONES_IDIOMA = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'en', etiqueta: 'English' },
  { valor: 'pt', etiqueta: 'Português' },
]

const OPCIONES_FORMATO_FECHA = [
  { valor: 'DD/MM/YYYY', etiqueta: 'DD/MM/YYYY' },
  { valor: 'MM/DD/YYYY', etiqueta: 'MM/DD/YYYY' },
  { valor: 'YYYY-MM-DD', etiqueta: 'YYYY-MM-DD' },
]

const OPCIONES_PERIODO_ALERTA = [
  { valor: '24', etiqueta: 'Cada 24 horas' },
  { valor: '48', etiqueta: 'Cada 48 horas' },
  { valor: '72', etiqueta: 'Cada 72 horas' },
  { valor: '168', etiqueta: 'Semanal' },
]

const OPCIONES_TIEMPO_SESION = [
  { valor: '30', etiqueta: '30 minutos' },
  { valor: '60', etiqueta: '1 hora' },
  { valor: '120', etiqueta: '2 horas' },
  { valor: '480', etiqueta: '8 horas' },
]

export default function PaginaConfiguracionGeneral() {
  const [config, setConfig] = useState({
    nombreSistema: 'Botica ML',
    descripcion: 'Sistema de gestión de inventario con Machine Learning',
    zonaHoraria: 'America/Lima',
    idioma: 'es',
    formatoFecha: 'DD/MM/YYYY',
    tiempoSesion: '60',
    alertasStockCritico: true,
    alertasVencimiento: true,
    alertasPrediccion: true,
    periodicidadAlertas: '24',
    notificacionesCorreo: true,
    autenticacionDosFactores: false,
    auditoriaHabilitada: true,
  })

  const [guardado, setGuardado] = useState(false)

  const manejarCambio = (campo, valor) => {
    setConfig(prev => ({ ...prev, [campo]: valor }))
  }

  const guardarConfig = () => {
    console.log('[Mock] Configuración guardada:', config)
    setGuardado(true)
    setTimeout(() => setGuardado(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-h1 text-principal">Configuración General</h1>
        <p className="text-cuerpo text-secundario mt-1">Parámetros generales del sistema y preferencias</p>
      </div>

      {guardado && <Alerta tipo="exito" titulo="Configuración guardada correctamente" />}

      <Tarjeta titulo="Información del Sistema" icono={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Nombre del Sistema</label>
            <input
              type="text"
              value={config.nombreSistema}
              onChange={e => manejarCambio('nombreSistema', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Zona Horaria</label>
            <select
              value={config.zonaHoraria}
              onChange={e => manejarCambio('zonaHoraria', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {OPCIONES_ZONA_HORARIA.map(op => (
                <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-sm font-medium text-principal">Descripción</label>
            <input
              type="text"
              value={config.descripcion}
              onChange={e => manejarCambio('descripcion', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Idioma</label>
            <select
              value={config.idioma}
              onChange={e => manejarCambio('idioma', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {OPCIONES_IDIOMA.map(op => (
                <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Formato de Fecha</label>
            <select
              value={config.formatoFecha}
              onChange={e => manejarCambio('formatoFecha', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {OPCIONES_FORMATO_FECHA.map(op => (
                <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
              ))}
            </select>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Alertas y Notificaciones" icono={Bell}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={config.alertasStockCritico}
                onChange={e => manejarCambio('alertasStockCritico', e.target.checked)}
                className="rounded border-estilo"
              />
              <div>
                <p className="text-sm font-medium text-principal">Stock Crítico</p>
                <p className="text-xs text-secundario">Alertas de inventario bajo mínimo</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={config.alertasVencimiento}
                onChange={e => manejarCambio('alertasVencimiento', e.target.checked)}
                className="rounded border-estilo"
              />
              <div>
                <p className="text-sm font-medium text-principal">Vencimientos</p>
                <p className="text-xs text-secundario">Alertas de lotes próximos a vencer</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={config.alertasPrediccion}
                onChange={e => manejarCambio('alertasPrediccion', e.target.checked)}
                className="rounded border-estilo"
              />
              <div>
                <p className="text-sm font-medium text-principal">Predicciones ML</p>
                <p className="text-xs text-secundario">Alertas generadas por el modelo</p>
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-1.5 max-w-xs">
            <label className="text-sm font-medium text-principal">Periodicidad de Alertas</label>
            <select
              value={config.periodicidadAlertas}
              onChange={e => manejarCambio('periodicidadAlertas', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {OPCIONES_PERIODO_ALERTA.map(op => (
                <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.notificacionesCorreo}
              onChange={e => manejarCambio('notificacionesCorreo', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Notificaciones por Correo</p>
              <p className="text-xs text-secundario">Enviar notificaciones a los correos registrados</p>
            </div>
          </label>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Seguridad y Auditoría" icono={Shield}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 max-w-xs">
            <label className="text-sm font-medium text-principal">Tiempo de Sesión</label>
            <select
              value={config.tiempoSesion}
              onChange={e => manejarCambio('tiempoSesion', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {OPCIONES_TIEMPO_SESION.map(op => (
                <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.auditoriaHabilitada}
              onChange={e => manejarCambio('auditoriaHabilitada', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Auditoría de Actividades</p>
              <p className="text-xs text-secundario">Registrar todas las acciones del sistema</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-fondo rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={config.autenticacionDosFactores}
              onChange={e => manejarCambio('autenticacionDosFactores', e.target.checked)}
              className="rounded border-estilo"
            />
            <div>
              <p className="text-sm font-medium text-principal">Autenticación de Dos Factores</p>
              <p className="text-xs text-secundario">Requerir 2FA para todos los usuarios</p>
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
