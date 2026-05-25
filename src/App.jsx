import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'

import Rutas from '@/routing/Rutas'
import ProveedorTema from '@/components/common/ProveedorTema'
import useAutenticacion from '@/state/useAutenticacion'

function App() {
  const inicializar = useAutenticacion((s) => s.inicializar)

  useEffect(() => {
    inicializar()
  }, [inicializar])

  return (
    <BrowserRouter>
      <ProveedorTema>
        <Rutas />
      </ProveedorTema>
    </BrowserRouter>
  )
}

export default App
