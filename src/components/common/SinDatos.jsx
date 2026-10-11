import { PackageOpen } from 'lucide-react'
import Boton from './Boton'

export default function SinDatos({ titulo = 'No hay datos', descripcion, textoAccion, alAccionar, icono: Icono = PackageOpen, className }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center ${className || ''}`}>
      <Icono className="h-10 w-10 sm:h-12 sm:w-12 text-secundario mb-4" />
      <h3 className="text-base sm:text-h3 text-principal mb-2">{titulo}</h3>
      {descripcion && <p className="text-sm text-secundario mb-6 max-w-md">{descripcion}</p>}
      {textoAccion && alAccionar && (
        <Boton variante="primario" onClick={alAccionar}>
          {textoAccion}
        </Boton>
      )}
    </div>
  )
}
