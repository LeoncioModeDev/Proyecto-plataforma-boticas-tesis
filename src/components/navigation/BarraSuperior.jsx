import { Bell, Search, User, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'
import useAlertas from '@/state/useAlertas'
import useBarraLateral from '@/state/useBarraLateral'
import MigaDePan from './MigaDePan'
import ControlesInterfaz from '@/components/common/ControlesInterfaz'

export default function BarraSuperior() {
  const { usuario, cerrarSesion } = useAutenticacion()
  const { colapsada } = useBarraLateral()
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
    <header className={`fixed top-0 right-0 h-14 bg-fondo-secundario border-b border-estilo flex items-center justify-between px-4 lg:px-6 z-30 transition-all duration-200 ${colapsada ? 'left-16' : 'left-56 lg:left-60'}`}>
      <MigaDePan />

      <div className="flex items-center gap-2 lg:gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-fondo border border-estilo rounded-md w-44 lg:w-56">
          <Search className="h-4 w-4 text-secundario" />
          <span className="text-secundario text-sm">Buscar...</span>
        </div>

        <ControlesInterfaz />

        <button className="relative p-2 rounded-md hover:bg-fondo transition-colors">
          <Bell className="h-[18px] w-[18px] text-secundario" />
          {contadorAlertas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-estado-critico text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
              {contadorAlertas}
            </span>
          )}
        </button>

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
