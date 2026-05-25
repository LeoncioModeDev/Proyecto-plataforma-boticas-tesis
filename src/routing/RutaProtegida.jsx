import { Navigate } from 'react-router-dom'
import useAutenticacion from '@/state/useAutenticacion'

export default function RutaProtegida({ rolesPermitidos, children }) {
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

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/no-autorizado" replace />
  }

  return children
}
