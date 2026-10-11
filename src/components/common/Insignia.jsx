import { cn } from '@/utilities/cn'

const estilosColor = {
  verde: 'bg-marca-claro text-marca-principal',
  gris: 'bg-gray-100 dark:bg-gray-800 text-secundario',
  rojo: 'bg-estado-critico-fondo text-estado-critico',
  amarillo: 'bg-estado-advertencia-fondo text-estado-advertencia',
  azul: 'bg-estado-info-fondo text-estado-info',
}

export default function Insignia({ color = 'verde', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        estilosColor[color] || estilosColor.gris,
        className
      )}
    >
      {children}
    </span>
  )
}
