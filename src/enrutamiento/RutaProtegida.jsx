import { Navigate } from 'react-router-dom'
import useAutenticacion from '@/estado/useAutenticacion'

/**
 * Componente que protege rutas verificando autenticación y rol.
 * Redirige a login si no hay sesión o si el rol no está autorizado.
 */
export default function RutaProtegida({ rolesPermitidos, children }) {
  const { usuario, autenticado } = useAutenticacion()

  if (!autenticado || !usuario) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  return children
}
