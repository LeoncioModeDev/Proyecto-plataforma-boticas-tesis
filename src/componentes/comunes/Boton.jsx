import { cn } from '@/utilidades/cn'
import { Loader2 } from 'lucide-react'

/**
 * Botón reutilizable con variantes primario, secundario y texto.
 * Soporta tres tamaños, estado de carga y icono opcional.
 */

const estilosVariante = {
  primario: 'bg-marca-principal text-white hover:bg-marca-oscuro focus-visible:ring-marca-principal',
  secundario: 'bg-white text-neutro-negro-suave border border-neutro-gris-borde hover:bg-neutro-blanco-suave',
  texto: 'bg-transparent text-marca-principal hover:underline',
}

const estilosTamano = {
  pequeno: 'px-3 py-1.5 text-etiqueta',
  mediano: 'px-4 py-2 text-cuerpo',
  grande: 'px-6 py-2.5 text-cuerpo font-semibold',
}

export default function Boton({
  variante = 'primario',
  tamano = 'mediano',
  icono: Icono = null,
  cargando = false,
  deshabilitado = false,
  onClick,
  tipo = 'button',
  children,
  className,
  ...props
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado || cargando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-boton font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        estilosVariante[variante],
        estilosTamano[tamano],
        className
      )}
      {...props}
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icono ? (
        <Icono className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  )
}
