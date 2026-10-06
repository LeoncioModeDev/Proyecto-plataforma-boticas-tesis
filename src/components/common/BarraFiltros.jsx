import Boton from './Boton'
import { cn } from '@/utilities/cn'

export default function BarraFiltros({ children, alLimpiar, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end', className)}>
      {children}
      {alLimpiar && (
        <Boton variante="secundario" onClick={alLimpiar} className="w-full sm:w-auto">
          Limpiar filtros
        </Boton>
      )}
    </div>
  )
}
