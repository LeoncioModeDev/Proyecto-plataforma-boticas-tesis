import { Link } from 'react-router-dom'
import Boton from '@/components/common/Boton'

export default function RestablecerContrasena() {
  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-8 text-center">
        <h2 className="text-h2 text-principal mb-4">Restablecer Contraseña</h2>
        <p className="text-cuerpo text-secundario mb-6">
          Esta funcionalidad estará disponible cuando se conecte Supabase Auth en la Fase 2 del proyecto.
        </p>
        <Link to="/iniciar-sesion">
          <Boton variante="secundario">Volver al inicio de sesión</Boton>
        </Link>
      </div>
    </div>
  )
}
