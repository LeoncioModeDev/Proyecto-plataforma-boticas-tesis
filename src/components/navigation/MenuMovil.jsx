import { Menu } from 'lucide-react'
import { useState } from 'react'
import BarraLateral from './BarraLateral'

export default function MenuMovil() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="lg:hidden">
      <button onClick={() => setAbierto(true)} className="p-2 rounded-md hover:bg-fondo transition-colors">
        <Menu className="h-5 w-5 text-principal" />
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
