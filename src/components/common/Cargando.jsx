import { cn } from '@/utilities/cn'

const tamanos = {
  pequeno: 'h-4 w-4',
  mediano: 'h-6 w-6',
  grande: 'h-10 w-10',
}

export default function Cargando({ tamano = 'mediano', className, mensaje }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-estilo border-t-marca-principal',
          tamanos[tamano]
        )}
      />
      {mensaje && <p className="text-sm text-secundario">{mensaje}</p>}
    </div>
  )
}
