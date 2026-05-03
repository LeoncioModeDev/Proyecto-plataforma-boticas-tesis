import { cn } from '@/utilidades/cn'

/**
 * Spinner circular de carga con animación de rotación.
 */

const tamanos = {
  pequeno: 'h-4 w-4',
  mediano: 'h-6 w-6',
  grande: 'h-10 w-10',
}

export default function Cargando({ tamano = 'mediano', className }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-neutro-gris-borde border-t-marca-principal',
          tamanos[tamano]
        )}
      />
    </div>
  )
}
