import { PackageOpen } from 'lucide-react'
import Boton from './Boton'

/**
 * Estado vacío con ilustración, mensaje y acción opcional.
 */
export default function SinDatos({ titulo = 'No hay datos', descripcion, textoAccion, alAccionar, icono: Icono = PackageOpen }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Icono className="h-12 w-12 text-neutro-gris-borde mb-4" />
      <h3 className="text-h3 text-neutro-negro mb-2">{titulo}</h3>
      {descripcion && <p className="text-cuerpo text-neutro-gris-texto mb-6 max-w-md">{descripcion}</p>}
      {textoAccion && alAccionar && (
        <Boton variante="primario" onClick={alAccionar}>
          {textoAccion}
        </Boton>
      )}
    </div>
  )
}
