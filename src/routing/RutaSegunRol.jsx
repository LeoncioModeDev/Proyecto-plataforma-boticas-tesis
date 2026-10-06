import { Navigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'

export default function RutaSegunRol({ roles, adminCentral, operadorDrogueria, visorBotica, fallback }) {
  const { usuario, autenticado, cargando } = useAutenticacion()

  if (cargando) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marca-principal" />
      </div>
    )
  }

  if (!autenticado || !usuario) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  if (roles) {
    return roles[usuario.rol] ?? fallback ?? <Navigate to="/no-autorizado" replace />
  }

  const mapa = {
    [ROLES.ADMIN_CENTRAL]: adminCentral,
    [ROLES.OPERADOR_DROGUERIA]: operadorDrogueria,
    [ROLES.VISOR_BOTICA]: visorBotica,
  }

  return mapa[usuario.rol] ?? fallback ?? <Navigate to="/no-autorizado" replace />
}
