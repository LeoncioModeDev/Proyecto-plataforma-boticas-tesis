import { Search } from 'lucide-react'
import { cn } from '@/utilities/cn'

/**
 * Campo de búsqueda con icono de lupa estilo Fluent.
 */
export default function CampoBusqueda({ valor, alCambiar, placeholder = 'Buscar...', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutro-gris-texto" />
      <input
        type="text"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                   placeholder:text-neutro-gris-texto
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors"
      />
    </div>
  )
}
