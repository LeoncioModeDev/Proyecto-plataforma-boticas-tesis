import { AlertTriangle, RefreshCw } from 'lucide-react'
import Boton from './Boton'

/**
 * Pantalla genérica de error con icono, mensaje y botón de reintentar.
 */
export default function ErrorFrontend({ titulo = 'Algo salió mal', descripcion = 'Ocurrió un error inesperado.', alReintentar }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-estado-critico mb-4" />
      <h2 className="text-h2 text-neutro-negro mb-2">{titulo}</h2>
      <p className="text-cuerpo text-neutro-gris-texto mb-6 max-w-md">{descripcion}</p>
      {alReintentar && (
        <Boton variante="primario" icono={RefreshCw} onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  )
}
