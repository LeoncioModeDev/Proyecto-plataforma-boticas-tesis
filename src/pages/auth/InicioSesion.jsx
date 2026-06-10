import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Sun, Moon } from 'lucide-react'

import useAutenticacion from '@/state/useAutenticacion'
import Boton from '@/components/common/Boton'
import useTema from '@/state/useTema'

const RUTA_POR_ROL = {
  super_admin: '/admin-saas/dashboard',
  admin_central: '/central/dashboard',
  operador_drogueria: '/operaciones/dashboard',
  visor_botica: '/botica/dashboard',
}

export default function InicioSesion() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const { iniciarSesion } = useAutenticacion()
  const navegar = useNavigate()
  const { tema, cambiarTema } = useTema()

  const manejarSubmit = async (e) => {
    e.preventDefault()
    if (!email || !contrasena) {
      setError('Ingresa tu correo y contraseña')
      return
    }
    setEnviando(true)
    setError(null)

    const { error: errorAuth } = await iniciarSesion(email, contrasena)
    if (errorAuth) {
      setError(errorAuth.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : errorAuth.message
      )
      setEnviando(false)
      return
    }

    const estado = useAutenticacion.getState()
    const ruta = RUTA_POR_ROL[estado.usuario?.rol] || '/'
    navegar(ruta)
  }

  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center p-4 sm:p-8 transition-colors">
      <button
        onClick={cambiarTema}
        className="fixed top-4 right-4 p-2 rounded-lg bg-fondo-secundario border border-estilo hover:bg-fondo transition-colors"
        title={tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
      >
        {tema === 'claro' ? <Moon className="h-5 w-5 text-secundario" /> : <Sun className="h-5 w-5 text-amber-400" />}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-marca-principal rounded-xl flex items-center justify-center mx-auto mb-4 shadow-estilo">
            <span className="text-white font-bold text-xl sm:text-2xl">B</span>
          </div>
          <h1 className="text-2xl sm:text-h1 text-principal font-semibold">Botica Demand ML</h1>
          <p className="text-sm sm:text-secundario text-secundario mt-2">
            Gestión inteligente de inventario y predicción de demanda
          </p>
        </div>

        <div className="bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-6 sm:p-8 transition-colors">
          <form onSubmit={manejarSubmit} className="space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-principal">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@boticaml.pe"
                className="px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md
                           placeholder:text-secundario
                           focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                           transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contrasena" className="text-sm font-medium text-principal">
                Contraseña
              </label>
              <input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                className="px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md
                           placeholder:text-secundario
                           focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                           transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
            )}

            <Boton tipo="submit" variante="primario" tamano="grande" icono={LogIn} className="w-full" deshabilitado={enviando}>
              {enviando ? 'Ingresando…' : 'Iniciar sesión'}
            </Boton>
          </form>

          <div className="mt-4 text-center">
            <a href="/restablecer-contrasena" className="text-sm text-marca-principal hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <p className="text-center text-xs sm:text-etiqueta text-secundario mt-6">
          Universidad Peruana de Ciencias Aplicadas — Tesis 2026
        </p>
      </div>
    </div>
  )
}
