import { cn } from '@/utilidades/cn'

/**
 * Tarjeta contenedora con estilo Fluent.
 * Soporta título, descripción y acción en la cabecera.
 */
export default function Tarjeta({ titulo, descripcion, accionDerecha, children, className, ...props }) {
  return (
    <div
      className={cn(
        'bg-white border border-neutro-gris-borde rounded-tarjeta shadow-suave',
        className
      )}
      {...props}
    >
      {(titulo || accionDerecha) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutro-gris-borde">
          <div>
            {titulo && <h3 className="text-h3 text-neutro-negro">{titulo}</h3>}
            {descripcion && <p className="text-secundario text-neutro-gris-texto mt-1">{descripcion}</p>}
          </div>
          {accionDerecha && <div>{accionDerecha}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
