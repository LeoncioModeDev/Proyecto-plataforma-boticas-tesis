import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft } from 'lucide-react'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'

const RUTA_POR_ROL = {
  [ROLES.ADMIN_CENTRAL]: '/central/dashboard',
  [ROLES.OPERADOR_DROGUERIA]: '/operaciones/dashboard',
  [ROLES.VISOR_BOTICA]: '/botica/dashboard',
}

export default function PaginaNoAutorizado() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const rutaInicio = RUTA_POR_ROL[usuario?.rol] || '/'

  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-rojo-claro rounded-xl flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="h-8 w-8 text-rojo" />
        </div>
        <h1 className="text-2xl font-bold text-principal mb-2">Acceso no autorizado</h1>
        <p className="text-secundario mb-8">
          No tienes permisos suficientes para acceder a esta sección.
          {usuario && <span className="block mt-1 text-sm">Rol actual: <span className="font-medium text-principal">{usuario.rol}</span></span>}
        </p>
        <button
          onClick={() => navegar(rutaInicio)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-marca-principal text-white rounded-lg hover:bg-marca-oscuro transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
