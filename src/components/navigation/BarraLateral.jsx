import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Boxes, CalendarClock, ArrowLeftRight,
  ClipboardList, FileBarChart, Truck, Users, BrainCircuit, Bell,
  Lightbulb, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/utilities/cn'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES, ETIQUETAS_ROLES } from '@/constants/roles'
import { useState } from 'react'

/**
 * Barra lateral de navegación fija con items filtrados por rol.
 */

const itemsNavegacion = {
  [ROLES.ADMIN_CENTRAL]: [
    { etiqueta: 'Dashboard', ruta: '/central/dashboard', icono: LayoutDashboard },
    { tipo: 'separador', etiqueta: 'Inventario' },
    { etiqueta: 'Catálogo', ruta: '/central/inventario/catalogo', icono: Package },
    { etiqueta: 'Stock', ruta: '/central/inventario/stock', icono: Boxes },
    { etiqueta: 'Lotes', ruta: '/central/inventario/lotes', icono: CalendarClock },
    { etiqueta: 'Movimientos', ruta: '/central/inventario/movimientos', icono: ArrowLeftRight },
    { etiqueta: 'Ajustes', ruta: '/central/inventario/ajustes', icono: ClipboardList },
    { etiqueta: 'Reportes', ruta: '/central/inventario/reportes', icono: FileBarChart },
    { tipo: 'separador', etiqueta: 'Otros Módulos' },
    { etiqueta: 'Distribución', ruta: '/central/distribucion', icono: Truck },
    { etiqueta: 'Proveedores', ruta: '/central/proveedores', icono: Users },
    { tipo: 'separador', etiqueta: 'Machine Learning' },
    { etiqueta: 'Predicciones', ruta: '/ml/predicciones', icono: BrainCircuit },
    { etiqueta: 'Alertas ML', ruta: '/ml/alertas', icono: Bell },
    { etiqueta: 'Recomendaciones', ruta: '/ml/recomendaciones', icono: Lightbulb },
  ],
  [ROLES.OPERADOR_DROGUERIA]: [
    { etiqueta: 'Stock', ruta: '/botica/stock', icono: Boxes },
    { etiqueta: 'Lotes', ruta: '/botica/lotes', icono: CalendarClock },
    { etiqueta: 'Movimientos', ruta: '/botica/movimientos', icono: ArrowLeftRight },
  ],
  [ROLES.VISOR_BOTICA]: [
    { etiqueta: 'Predicciones', ruta: '/ml/predicciones', icono: BrainCircuit },
    { etiqueta: 'Alertas', ruta: '/ml/alertas', icono: Bell },
    { etiqueta: 'Recomendaciones', ruta: '/ml/recomendaciones', icono: Lightbulb },
  ],
}

export default function BarraLateral() {
  const { usuario, cerrarSesion } = useAutenticacion()
  const navegar = useNavigate()
  const [colapsada, setColapsada] = useState(false)

  if (!usuario) return null

  const items = itemsNavegacion[usuario.rol] || []

  const manejarCerrarSesion = () => {
    cerrarSesion()
    navegar('/iniciar-sesion')
  }

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-white border-r border-neutro-gris-borde flex flex-col z-40 transition-all duration-200',
      colapsada ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-neutro-gris-borde shrink-0">
        <div className="w-8 h-8 bg-marca-principal rounded flex items-center justify-center">
          <span className="text-white font-bold text-sm">B</span>
        </div>
        {!colapsada && <span className="font-semibold text-neutro-negro text-cuerpo">Botica ML</span>}
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {items.map((item, i) => {
          if (item.tipo === 'separador') {
            return !colapsada ? (
              <p key={i} className="px-3 pt-4 pb-1 text-etiqueta text-neutro-gris-texto uppercase tracking-wider">
                {item.etiqueta}
              </p>
            ) : <div key={i} className="my-2 border-t border-neutro-gris-borde mx-2" />
          }

          const Icono = item.icono
          return (
            <NavLink
              key={item.ruta}
              to={item.ruta}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-boton text-cuerpo transition-colors mb-0.5',
                isActive
                  ? 'bg-marca-claro text-marca-principal font-medium border-l-[3px] border-marca-principal'
                  : 'text-neutro-negro-suave hover:bg-neutro-blanco-suave'
              )}
              title={colapsada ? item.etiqueta : undefined}
            >
              <Icono className="h-[18px] w-[18px] shrink-0" />
              {!colapsada && <span>{item.etiqueta}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Usuario y Cerrar sesión */}
      <div className="border-t border-neutro-gris-borde p-3">
        {!colapsada && (
          <div className="mb-2 px-1">
            <p className="text-cuerpo font-medium text-neutro-negro truncate">{usuario.nombre}</p>
            <p className="text-etiqueta text-neutro-gris-texto">{ETIQUETAS_ROLES[usuario.rol]}</p>
          </div>
        )}
        <button
          onClick={manejarCerrarSesion}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-boton text-cuerpo text-neutro-gris-texto hover:bg-neutro-blanco-suave transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!colapsada && <span>Cerrar sesión</span>}
        </button>
      </div>

      {/* Botón colapsar */}
      <button
        onClick={() => setColapsada(!colapsada)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-neutro-gris-borde rounded-full flex items-center justify-center shadow-suave hover:bg-neutro-blanco-suave z-50"
      >
        {colapsada ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
