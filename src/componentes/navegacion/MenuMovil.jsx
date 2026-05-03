import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import BarraLateral from './BarraLateral'

/**
 * Menú hamburguesa para pantallas móviles.
 */
export default function MenuMovil() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="lg:hidden">
      <button onClick={() => setAbierto(true)} className="p-2 rounded hover:bg-neutro-blanco-suave">
        <Menu className="h-5 w-5 text-neutro-negro-suave" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setAbierto(false)} />
          <div className="fixed left-0 top-0 h-full z-50">
            <BarraLateral />
          </div>
        </>
      )}
    </div>
  )
}
