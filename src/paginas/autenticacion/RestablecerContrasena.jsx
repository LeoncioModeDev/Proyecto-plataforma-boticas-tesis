import { Link } from 'react-router-dom'
import Boton from '@/componentes/comunes/Boton'

/**
 * Pantalla placeholder para restablecer contraseña.
 * Se implementará con Supabase Auth en fase posterior.
 */
export default function RestablecerContrasena() {
  return (
    <div className="min-h-screen bg-neutro-blanco-suave flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-neutro-gris-borde rounded-tarjeta shadow-suave p-8 text-center">
        <h2 className="text-h2 text-neutro-negro mb-4">Restablecer Contraseña</h2>
        <p className="text-cuerpo text-neutro-gris-texto mb-6">
          Esta funcionalidad estará disponible cuando se conecte Supabase Auth en la Fase 2 del proyecto.
        </p>
        <Link to="/iniciar-sesion">
          <Boton variante="secundario">Volver al inicio de sesión</Boton>
        </Link>
      </div>
    </div>
  )
}
