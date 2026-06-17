import { Bell, Search, User, LogOut, LayoutDashboard, Building2, CheckCheck, Eye, AlertTriangle, Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'
import useAlertas from '@/state/useAlertas'
import useBarraLateral from '@/state/useBarraLateral'
import MigaDePan from './MigaDePan'
import ControlesInterfaz from '@/components/common/ControlesInterfaz'
import Insignia from '@/components/common/Insignia'
import { obtenerPortal } from '@/utilities/permisos'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const COLORES_URGENCIA = {
  alta: 'rojo',
  media: 'amarillo',
  baja: 'gris',
}

const ETIQUETAS_URGENCIA = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const ICONOS_TIPO = {
  quiebre: AlertTriangle,
  vencimiento: Info,
  sobrestock: Info,
  prediccion: Eye,
}

export default function BarraSuperior() {
  const { usuario, cerrarSesion } = useAutenticacion()
  const { colapsada } = useBarraLateral()
  const alertasStore = useAlertas()
  const contadorAlertas = alertasStore.obtenerContadorNoLeidas()
  const alertasNoLeidas = alertasStore.obtenerNoLeidas()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const refMenu = useRef(null)
  const refNotif = useRef(null)

  useEffect(() => { alertasStore.cargarAlertas() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cerrar = (e) => {
      if (refMenu.current && !refMenu.current.contains(e.target)) setMenuAbierto(false)
      if (refNotif.current && !refNotif.current.contains(e.target)) setNotifAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const portal = obtenerPortal(usuario)
  const PORTAL_ICONOS = {
    central: LayoutDashboard,
    operaciones: LayoutDashboard,
    botica: Building2,
  }
  const IconoPortal = PORTAL_ICONOS[portal] || LayoutDashboard

  return (
    <header className={`fixed top-0 right-0 h-14 bg-fondo-secundario border-b border-estilo flex items-center justify-between px-4 lg:px-6 z-30 transition-all duration-200 ${colapsada ? 'left-16' : 'left-56 lg:left-60'}`}>
      <div className="flex items-center gap-3">
        <IconoPortal className="h-4 w-4 text-marca-principal hidden sm:block" />
        <MigaDePan />
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-fondo border border-estilo rounded-md w-44 lg:w-56">
          <Search className="h-4 w-4 text-secundario" />
          <span className="text-secundario text-sm">Buscar...</span>
        </div>

        <ControlesInterfaz />

        <div className="relative" ref={refNotif}>
          <button
            onClick={() => setNotifAbierto(!notifAbierto)}
            className="relative p-2 rounded-md hover:bg-fondo transition-colors"
          >
            <Bell className="h-[18px] w-[18px] text-secundario" />
            {contadorAlertas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-estado-critico text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                {contadorAlertas}
              </span>
            )}
          </button>

          {notifAbierto && (
            <div className="absolute right-0 mt-1 w-80 bg-fondo-secundario border border-estilo rounded-lg shadow-estilo-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-estilo">
                <p className="text-sm font-semibold text-principal">Notificaciones</p>
                {contadorAlertas > 0 && (
                  <button
                    onClick={() => { alertasStore.marcarTodasComoLeidas(); setNotifAbierto(false) }}
                    className="flex items-center gap-1 text-xs text-marca-principal hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />Marcar todas leídas
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {alertasNoLeidas.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Bell className="h-8 w-8 text-secundario mb-2" />
                    <p className="text-sm text-secundario">No hay notificaciones</p>
                  </div>
                ) : (
                  alertasNoLeidas.slice(0, 5).map(alerta => {
                    const IconoTipo = ICONOS_TIPO[alerta.tipo] || Info
                    return (
                      <div
                        key={alerta.id}
                        className="flex gap-3 px-4 py-3 hover:bg-fondo transition-colors cursor-pointer border-b border-estilo last:border-b-0"
                        onClick={() => {
                          alertasStore.marcarComoLeida(alerta.id)
                          setNotifAbierto(false)
                        }}
                      >
                        <div className={`p-1.5 rounded-full shrink-0 h-7 w-7 flex items-center justify-center ${
                          alerta.urgencia === 'alta' ? 'bg-estado-critico-fondo' : 'bg-fondo'
                        }`}>
                          <IconoTipo className={`h-3.5 w-3.5 ${
                            alerta.urgencia === 'alta' ? 'text-estado-critico' : 'text-secundario'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-principal line-clamp-2">{alerta.mensaje}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Insignia color={COLORES_URGENCIA[alerta.urgencia]}>{ETIQUETAS_URGENCIA[alerta.urgencia]}</Insignia>
                            <span className="text-[10px] text-secundario">{formatearFechaRelativa(alerta.fechaCreacion)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t border-estilo px-4 py-2">
                <button
                  onClick={() => { navegar('/ml/alertas'); setNotifAbierto(false) }}
                  className="w-full text-center text-xs text-marca-principal hover:underline py-1"
                >
                  Ver todas las alertas
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={refMenu}>
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-fondo transition-colors"
          >
            <div className="w-8 h-8 bg-marca-claro dark:bg-marca-claro rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-marca-principal" />
            </div>
          </button>

          {menuAbierto && (
            <div className="absolute right-0 mt-1 w-56 bg-fondo-secundario border border-estilo rounded-lg shadow-estilo-lg py-1 z-50">
              <div className="px-4 py-3 border-b border-estilo">
                <p className="text-cuerpo font-medium text-principal">{usuario?.nombre}</p>
                <p className="text-etiqueta text-secundario">{usuario?.email}</p>
              </div>
              <button
                onClick={() => { cerrarSesion(); navegar('/iniciar-sesion'); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-cuerpo text-secundario hover:bg-fondo transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
