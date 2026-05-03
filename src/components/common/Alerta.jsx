import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/utilities/cn'

/**
 * Alerta inline con icono para mensajes de estado.
 * Tipos: exito, advertencia, error, info.
 */

const configuracion = {
  exito: { icono: CheckCircle, fondo: 'bg-marca-claro', borde: 'border-marca-principal', texto: 'text-marca-principal' },
  advertencia: { icono: AlertTriangle, fondo: 'bg-estado-advertencia-fondo', borde: 'border-estado-advertencia', texto: 'text-estado-advertencia' },
  error: { icono: XCircle, fondo: 'bg-estado-critico-fondo', borde: 'border-estado-critico', texto: 'text-estado-critico' },
  info: { icono: Info, fondo: 'bg-estado-info-fondo', borde: 'border-estado-info', texto: 'text-estado-info' },
}

export default function Alerta({ tipo = 'info', titulo, mensaje, alCerrar }) {
  const config = configuracion[tipo]
  const IconoAlerta = config.icono

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-boton border', config.fondo, config.borde)}>
      <IconoAlerta className={cn('h-5 w-5 mt-0.5 shrink-0', config.texto)} />
      <div className="flex-1 min-w-0">
        {titulo && <p className={cn('text-cuerpo font-semibold', config.texto)}>{titulo}</p>}
        {mensaje && <p className="text-secundario text-neutro-negro-suave mt-0.5">{mensaje}</p>}
      </div>
      {alCerrar && (
        <button onClick={alCerrar} className="p-0.5 rounded hover:bg-black/5 shrink-0">
          <X className="h-4 w-4 text-neutro-gris-texto" />
        </button>
      )}
    </div>
  )
}
