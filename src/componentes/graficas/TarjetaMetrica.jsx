import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/utilidades/cn'

/**
 * Tarjeta de KPI con valor grande, etiqueta y variación porcentual.
 */
export default function TarjetaMetrica({ etiqueta, valor, variacion, icono: Icono, className }) {
  const esPositivo = variacion > 0

  return (
    <div className={cn('bg-white border border-neutro-gris-borde rounded-tarjeta shadow-suave p-6', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-secundario text-neutro-gris-texto mb-1">{etiqueta}</p>
          <p className="text-h1 text-neutro-negro">{valor}</p>
          {variacion !== undefined && variacion !== null && (
            <div className={cn('flex items-center gap-1 mt-2 text-etiqueta font-medium', esPositivo ? 'text-marca-principal' : 'text-estado-critico')}>
              {esPositivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{esPositivo ? '+' : ''}{variacion}% vs mes anterior</span>
            </div>
          )}
        </div>
        {Icono && (
          <div className="p-2.5 bg-marca-claro rounded-tarjeta">
            <Icono className="h-5 w-5 text-marca-principal" />
          </div>
        )}
      </div>
    </div>
  )
}
