import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Sun, Moon } from 'lucide-react'

import useAutenticacion from '@/state/useAutenticacion'
import { ROLES, ETIQUETAS_ROLES } from '@/constants/roles'
import Boton from '@/components/common/Boton'
import useTema from '@/state/useTema'

export default function InicioSesion() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState(ROLES.ADMIN_CENTRAL)
  const { iniciarSesion } = useAutenticacion()
  const navegar = useNavigate()
  const { tema, cambiarTema } = useTema()

  const manejarSubmit = (e) => {
    e.preventDefault()
    iniciarSesion(rolSeleccionado)

    switch (rolSeleccionado) {
      case ROLES.ADMIN_CENTRAL:
        navegar('/central/dashboard')
        break
      case ROLES.OPERADOR_DROGUERIA:
        navegar('/botica/stock')
        break
      case ROLES.VISOR_BOTICA:
        navegar('/ml/predicciones')
        break
      default:
        navegar('/')
    }
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rol" className="text-sm font-medium text-principal">
                Acceder como <span className="text-secundario font-normal">(modo desarrollo)</span>
              </label>
              <select
                id="rol"
                value={rolSeleccionado}
                onChange={(e) => setRolSeleccionado(e.target.value)}
                className="px-3 py-2.5 text-sm bg-marca-claro dark:bg-marca-claro border border-marca-principal rounded-md
                           text-marca-principal font-medium
                           focus:outline-none focus:ring-2 focus:ring-marca-principal focus:ring-offset-2
                           transition-colors"
              >
                <option value={ROLES.ADMIN_CENTRAL}>{ETIQUETAS_ROLES[ROLES.ADMIN_CENTRAL]}</option>
                <option value={ROLES.OPERADOR_DROGUERIA}>{ETIQUETAS_ROLES[ROLES.OPERADOR_DROGUERIA]}</option>
                <option value={ROLES.VISOR_BOTICA}>{ETIQUETAS_ROLES[ROLES.VISOR_BOTICA]}</option>
              </select>
            </div>

            <Boton tipo="submit" variante="primario" tamano="grande" icono={LogIn} className="w-full">
              Iniciar sesión
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
