import { BrowserRouter } from 'react-router-dom'

import Rutas from '@/routing/Rutas'

/**
 * Componente raíz de la aplicación.
 * Envuelve la app con BrowserRouter y renderiza el sistema de rutas.
 */
function App() {
  return (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  )
}

export default App
