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
        <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-estilo">
          <div>
            {titulo && <h3 className="text-h3 text-principal">{titulo}</h3>}
            {descripcion && <p className="text-secundario text-secundario mt-1">{descripcion}</p>}
          </div>
          {accionDerecha && <div>{accionDerecha}</div>}
        </div>
      )}
      <div className="p-4 lg:p-6">{children}</div>
    </div>
  )
}
