import { Sun, Moon, Maximize2, Minimize2 } from 'lucide-react'
import useTema from '@/state/useTema'
import { useEffect, useState } from 'react'

export default function ControlesInterfaz() {
  const { tema, cambiarTema } = useTema()
  const [esPantallaCompleta, setEsPantallaCompleta] = useState(false)

  useEffect(() => {
    const manejarCambio = () => {
      setEsPantallaCompleta(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', manejarCambio)
    return () => document.removeEventListener('fullscreenchange', manejarCambio)
  }, [])

  const manejarPantallaCompleta = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={cambiarTema}
        className="p-2 rounded-md hover:bg-fondo transition-colors"
        title={tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
      >
        {tema === 'claro' ? (
          <Moon className="h-[18px] w-[18px] text-secundario" />
        ) : (
          <Sun className="h-[18px] w-[18px] text-amber-400" />
        )}
      </button>
      
      <button
        onClick={manejarPantallaCompleta}
        className="p-2 rounded-md hover:bg-fondo transition-colors"
        title={esPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {esPantallaCompleta ? (
          <Minimize2 className="h-[18px] w-[18px] text-secundario" />
        ) : (
          <Maximize2 className="h-[18px] w-[18px] text-secundario" />
        )}
      </button>
    </div>
  )
}
