import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utilities/cn'

/**
 * Modal con overlay semitransparente.
 * Cierra con Escape y clic fuera del contenido.
 */

const tamanos = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export default function Modal({ abierto, alCerrar, titulo, children, tamano = 'md' }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={manejarClicOverlay}
    >
      <div
        ref={refContenido}
        className={cn(
          'bg-white rounded-tarjeta shadow-media w-full mx-4 max-h-[85vh] flex flex-col',
          tamanos[tamano]
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutro-gris-borde">
          <h2 className="text-h3 text-neutro-negro">{titulo}</h2>
          <button
            onClick={alCerrar}
            className="p-1 rounded hover:bg-neutro-blanco-suave text-neutro-gris-texto transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
