import { Target, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/utilities/cn'

export default function TarjetaMetricaKPI({
  etiqueta,
  valor,
  meta,
  unidad = '%',
  descripcion,
  icono: Icono,
  tipo = 'modelo',
  className,
}) {
  const tieneMeta = meta !== undefined && meta !== null
  const valorNumerico = typeof valor === 'number' ? valor : Number(valor)
  const puedeEvaluarMeta = tieneMeta && Number.isFinite(valorNumerico)

  let estado = 'neutro'
  let IconoEstado = null

  if (puedeEvaluarMeta && tipo === 'modelo') {
    const mapeCumplido = valorNumerico <= meta
    estado = mapeCumplido ? 'exito' : 'advertencia'
    IconoEstado = mapeCumplido ? CheckCircle : AlertCircle
  } else if (puedeEvaluarMeta && tipo === 'fillRate') {
    const fillRateCumplido = valorNumerico >= meta
    estado = fillRateCumplido ? 'exito' : 'advertencia'
    IconoEstado = fillRateCumplido ? CheckCircle : AlertCircle
  } else if (puedeEvaluarMeta && tipo === 'sobrestock') {
    const sobrestockMejorado = valorNumerico <= meta
    estado = sobrestockMejorado ? 'exito' : 'advertencia'
    IconoEstado = sobrestockMejorado ? CheckCircle : AlertCircle
  }

  const coloresEstado = {
    exito: 'text-marca-principal',
    advertencia: 'text-estado-advertencia',
    neutro: 'text-secundario',
  }

  return (
    <div className={cn('bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs sm:text-sm text-secundario truncate">{etiqueta}</p>
            {IconoEstado && (
              <IconoEstado className={cn('h-4 w-4 shrink-0', coloresEstado[estado])} />
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-xl sm:text-h1 text-principal font-semibold">{valor}</p>
            <span className="text-sm text-secundario">{unidad}</span>
          </div>
          {tieneMeta && (
            <div className="flex items-center gap-1 mt-1.5">
              <Target className="h-3.5 w-3.5 text-secundario" />
              <span className="text-xs text-secundario">
                Meta: {meta}{unidad}
              </span>
            </div>
          )}
          {descripcion && (
            <p className="text-xs text-secundario mt-2 line-clamp-2">{descripcion}</p>
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
