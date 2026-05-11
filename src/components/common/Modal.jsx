import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utilities/cn'

const tamanos = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ abierto, alCerrar, titulo, children, tamano = 'md', className }) {
  const refContenido = useRef(null)

  useEffect(() => {
    const manejarEscape = (e) => {
      if (e.key === 'Escape') alCerrar()
    }
    if (abierto) {
      document.addEventListener('keydown', manejarEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', manejarEscape)
      document.body.style.overflow = ''
    }
  }, [abierto, alCerrar])

  const manejarClicOverlay = (e) => {
    if (refContenido.current && !refContenido.current.contains(e.target)) {
      alCerrar()
    }
  }

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={manejarClicOverlay}
    >
      <div
        ref={refContenido}
        className={cn(
          'bg-fondo-secundario rounded-lg shadow-estilo-lg w-full max-h-[90vh] flex flex-col',
          tamanos[tamano],
          className
        )}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-estilo shrink-0">
          <h2 className="text-lg sm:text-h3 text-principal font-semibold">{titulo}</h2>
          <button
            onClick={alCerrar}
            className="p-1.5 rounded-md hover:bg-fondo text-secundario transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
