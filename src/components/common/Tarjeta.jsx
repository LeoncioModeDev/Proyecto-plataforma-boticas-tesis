import { cn } from '@/utilities/cn'

export default function Tarjeta({ titulo, descripcion, accionDerecha, children, className, ...props }) {
  return (
    <div
      className={cn(
        'bg-fondo-secundario border border-estilo rounded-lg shadow-estilo transition-colors',
        className
      )}
      {...props}
    >
      {(titulo || accionDerecha) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 lg:px-6 py-4 border-b border-estilo">
          <div className="min-w-0">
            {titulo && <h3 className="text-h3 text-principal">{titulo}</h3>}
            {descripcion && <p className="text-secundario text-secundario mt-1">{descripcion}</p>}
          </div>
          {accionDerecha && <div className="w-full sm:w-auto shrink-0">{accionDerecha}</div>}
        </div>
      )}
      <div className="p-4 lg:p-6 min-w-0">{children}</div>
    </div>
  )
}
