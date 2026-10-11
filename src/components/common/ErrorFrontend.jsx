import { AlertTriangle, RefreshCw } from 'lucide-react'
import Boton from './Boton'

export default function ErrorFrontend({ titulo = 'Algo salió mal', descripcion = 'Ocurrió un error inesperado.', alReintentar, className }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center ${className || ''}`}>
      <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-estado-critico mb-4" />
      <h2 className="text-lg sm:text-h2 text-principal mb-2 font-semibold">{titulo}</h2>
      <p className="text-sm text-secundario mb-6 max-w-md">{descripcion}</p>
      {alReintentar && (
        <Boton variante="primario" icono={RefreshCw} onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  )
}
