import { Menu, User, LogOut, LayoutDashboard, Building2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'
import useBarraLateral from '@/state/useBarraLateral'
import MigaDePan from './MigaDePan'
import ControlesInterfaz from '@/components/common/ControlesInterfaz'
import ModalConfirmar from '@/components/common/ModalConfirmar'
import { obtenerPortal } from '@/utilities/permisos'

export default function BarraSuperior({ onAbrirMenuMovil }) {
  const { usuario, cerrarSesion } = useAutenticacion()
  const { colapsada } = useBarraLateral()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const refMenu = useRef(null)

  useEffect(() => {
    const cerrar = (e) => {
      if (refMenu.current && !refMenu.current.contains(e.target)) setMenuAbierto(false)
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

  const manejarCerrarSesion = () => {
    cerrarSesion()
    navegar('/iniciar-sesion')
  }

  return (
    <>
    <header className={`fixed top-0 right-0 left-0 h-14 bg-fondo-secundario border-b border-estilo flex items-center justify-between px-3 sm:px-4 lg:px-6 z-30 transition-all duration-200 ${colapsada ? 'lg:left-16' : 'lg:left-60'}`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onAbrirMenuMovil}
          className="lg:hidden p-2 -ml-1 rounded-md hover:bg-fondo text-principal transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <IconoPortal className="h-4 w-4 text-marca-principal hidden sm:block" />
        <MigaDePan />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
        <ControlesInterfaz />

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
                onClick={() => { setMenuAbierto(false); setConfirmarSalida(true); }}
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
    <ModalConfirmar
      abierto={confirmarSalida}
      alCerrar={() => setConfirmarSalida(false)}
      alConfirmar={manejarCerrarSesion}
      titulo="Cerrar sesión"
      mensaje="¿Seguro que deseas cerrar la sesión actual?"
      etiquetaBoton="Cerrar sesión"
    />
    </>
  )
}
