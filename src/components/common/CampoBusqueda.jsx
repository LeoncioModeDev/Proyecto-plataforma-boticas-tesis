import { Search } from 'lucide-react'
import { cn } from '@/utilities/cn'

export default function CampoBusqueda({ valor, alCambiar, placeholder = 'Buscar...', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secundario" />
      <input
        type="text"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm bg-fondo border border-estilo rounded-md
                   placeholder:text-secundario
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors"
      />
    </div>
  )
}
