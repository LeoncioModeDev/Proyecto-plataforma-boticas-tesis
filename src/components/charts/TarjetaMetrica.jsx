import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/utilities/cn'

export default function TarjetaMetrica({ etiqueta, valor, variacion, icono: Icono, className }) {
  const esPositivo = variacion > 0

  return (
    <div className={cn('bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-4 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-secundario mb-1 truncate">{etiqueta}</p>
          <p className="text-xl sm:text-h1 text-principal font-semibold">{valor}</p>
          {variacion !== undefined && variacion !== null && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-medium', esPositivo ? 'text-marca-principal' : 'text-estado-critico')}>
              {esPositivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{esPositivo ? '+' : ''}{variacion}% vs mes anterior</span>
              <span className="sm:hidden">{esPositivo ? '+' : ''}{variacion}%</span>
            </div>
          )}
        </div>
        {Icono && (
          <div className="p-2 sm:p-2.5 bg-marca-claro rounded-lg shrink-0">
            <Icono className="h-4 w-4 sm:h-5 sm:w-5 text-marca-principal" />
          </div>
        )}
      </div>
    </div>
  )
}
