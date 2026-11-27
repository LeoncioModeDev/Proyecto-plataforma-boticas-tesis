import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'

import Rutas from '@/routing/Rutas'
import ProveedorTema from '@/components/common/ProveedorTema'
import useAutenticacion from '@/state/useAutenticacion'

function App() {
  const inicializar = useAutenticacion((s) => s.inicializar)
  const observarSesion = useAutenticacion((s) => s.observarSesion)

  useEffect(() => {
    const dejarDeObservar = observarSesion()
    inicializar()
    return dejarDeObservar
  }, [inicializar, observarSesion])

  return (
    <BrowserRouter>
      <ProveedorTema>
        <Rutas />
      </ProveedorTema>
    </BrowserRouter>
  )
}

export default App
