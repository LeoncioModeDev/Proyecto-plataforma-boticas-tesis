import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Sun, Moon, Mail, Key, Eye, EyeOff } from 'lucide-react'

import useAutenticacion from '@/state/useAutenticacion'
import Boton from '@/components/common/Boton'
import useTema from '@/state/useTema'
import LogoBoticAI from '@/assets/images/LogoBoticAI.png'

const RUTA_POR_ROL = {
  super_admin: '/admin-saas/dashboard',
  admin_central: '/central/dashboard',
  operador_drogueria: '/operaciones/dashboard',
  visor_botica: '/botica/dashboard',
}

export default function InicioSesion() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
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
    <div className="min-h-screen bg-fondo flex transition-colors">
      <button
        onClick={cambiarTema}
        className="fixed top-6 right-6 z-50 p-2.5 rounded-xl bg-fondo-secundario border border-estilo hover:bg-fondo transition-colors shadow-estilo"
        title={tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
      >
        {tema === 'claro' ? <Moon className="h-5 w-5 text-secundario" /> : <Sun className="h-5 w-5 text-amber-400" />}
      </button>

      <div className="flex w-full max-[900px]:flex-col max-[900px]:items-center max-[900px]:p-6">
        <div className="flex-[55] flex items-center justify-center p-8 lg:px-20 max-[900px]:p-0 max-[900px]:mb-8 max-[900px]:pt-8">
          <img
            src={LogoBoticAI}
            alt="BoticAI"
            className="w-full max-w-[480px] max-[900px]:max-w-[280px] object-contain"
          />
        </div>

        <div className="flex-[45] flex flex-col justify-center px-8 lg:px-16 xl:px-20 max-[900px]:px-0 max-[900px]:w-full max-[900px]:max-w-[480px]">
          <div className="max-w-[540px]">
            <h1 className="text-[36px] font-bold text-principal mb-2">
              Accede a BoticAI
            </h1>
            <p className="text-[18px] text-secundario leading-relaxed">
              Inicia sesión para gestionar el inventario y visualizar predicciones de demanda en tiempo real
            </p>

            <form onSubmit={manejarSubmit} className="mt-6 space-y-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-[15px] font-semibold text-principal">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-[18px] top-1/2 -translate-y-1/2 h-5 w-5 text-secundario" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@boticaml.pe"
                    className="w-full h-[56px] pl-12 pr-[18px] text-sm bg-fondo border border-estilo rounded-xl placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="contrasena" className="text-[15px] font-semibold text-principal">
                  Contraseña
                </label>
                <div className="relative">
                  <Key className="absolute left-[18px] top-1/2 -translate-y-1/2 h-5 w-5 text-secundario" />
                  <input
                    id="contrasena"
                    type={verContrasena ? 'text' : 'password'}
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className="w-full h-[56px] pl-12 pr-12 text-sm bg-fondo border border-estilo rounded-xl placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setVerContrasena(!verContrasena)}
                    className="absolute right-[18px] top-1/2 -translate-y-1/2 text-secundario hover:text-principal transition-colors"
                    tabIndex={-1}
                  >
                    {verContrasena ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <a
                  href="/restablecer-contrasena"
                  className="text-[14px] text-marca-principal hover:underline font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
              )}

              <Boton
                tipo="submit"
                variante="primario"
                tamano="grande"
                icono={LogIn}
                className="w-full h-[50px] rounded-lg text-[15px]"
                deshabilitado={enviando}
              >
                {enviando ? 'Ingresando…' : 'Iniciar sesión'}
              </Boton>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
