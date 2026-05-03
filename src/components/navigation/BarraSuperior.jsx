import { Bell, Search, User, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'
import useAlertas from '@/state/useAlertas'
import MigaDePan from './MigaDePan'

/**
 * Barra superior fija con título, búsqueda, notificaciones y avatar.
 */
export default function BarraSuperior() {
  const { usuario, cerrarSesion } = useAutenticacion()
  const contadorAlertas = useAlertas(s => s.obtenerContadorNoLeidas())
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const refMenu = useRef(null)

  useEffect(() => {
    const cerrar = (e) => {
      if (refMenu.current && !refMenu.current.contains(e.target)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  return (
    <header className="fixed top-0 right-0 left-60 h-14 bg-white border-b border-neutro-gris-borde flex items-center justify-between px-6 z-30">
      {/* Breadcrumbs */}
      <MigaDePan />

      {/* Lado derecho */}
      <div className="flex items-center gap-3">
        {/* Búsqueda decorativa */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutro-blanco-suave rounded-boton border border-neutro-gris-borde w-56">
          <Search className="h-4 w-4 text-neutro-gris-texto" />
          <span className="text-secundario text-neutro-gris-texto">Buscar...</span>
        </div>

        {/* Notificaciones */}
        <button className="relative p-2 rounded-boton hover:bg-neutro-blanco-suave transition-colors">
          <Bell className="h-[18px] w-[18px] text-neutro-negro-suave" />
          {contadorAlertas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-estado-critico text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
              {contadorAlertas}
            </span>
          )}
        </button>

        {/* Avatar con dropdown */}
        <div className="relative" ref={refMenu}>
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="flex items-center gap-2 p-1.5 rounded-boton hover:bg-neutro-blanco-suave transition-colors"
          >
            <div className="w-8 h-8 bg-marca-claro rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-marca-principal" />
            </div>
          </button>

          {menuAbierto && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-neutro-gris-borde rounded-tarjeta shadow-media py-1 z-50">
              <div className="px-4 py-3 border-b border-neutro-gris-borde">
                <p className="text-cuerpo font-medium text-neutro-negro">{usuario?.nombre}</p>
                <p className="text-etiqueta text-neutro-gris-texto">{usuario?.email}</p>
              </div>
              <button
                onClick={() => { cerrarSesion(); navegar('/iniciar-sesion'); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-cuerpo text-neutro-negro-suave hover:bg-neutro-blanco-suave transition-colors"
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
