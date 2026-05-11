import { BrowserRouter } from 'react-router-dom'

import Rutas from '@/routing/Rutas'
import ProveedorTema from '@/components/common/ProveedorTema'

/**
 * Componente raíz de la aplicación.
 * Envuelve la app con BrowserRouter y renderiza el sistema de rutas.
 */
function App() {
  return (
    <BrowserRouter>
      <ProveedorTema>
        <Rutas />
      </ProveedorTema>
    </BrowserRouter>
  )
}

export default App
