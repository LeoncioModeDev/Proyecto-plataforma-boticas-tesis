import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'

import useAutenticacion from '@/state/useAutenticacion'
import { ROLES, ETIQUETAS_ROLES } from '@/constants/roles'
import Boton from '@/components/common/Boton'

/**
 * Pantalla de inicio de sesión.
 * En modo mock, permite seleccionar un rol para acceder al sistema.
 */
export default function InicioSesion() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState(ROLES.ADMIN_CENTRAL)
  const { iniciarSesion } = useAutenticacion()
  const navegar = useNavigate()

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
    <div className="min-h-screen bg-neutro-blanco-suave flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-marca-principal rounded-xl flex items-center justify-center mx-auto mb-4 shadow-suave">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h1 className="text-h1 text-neutro-negro">Botica Demand ML</h1>
          <p className="text-secundario text-neutro-gris-texto mt-2">
            Gestión inteligente de inventario y predicción de demanda
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white border border-neutro-gris-borde rounded-tarjeta shadow-suave p-8">
          <form onSubmit={manejarSubmit} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-etiqueta font-medium text-neutro-negro-suave">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@boticaml.pe"
                className="px-3 py-2.5 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                           placeholder:text-neutro-gris-texto
                           focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                           transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contrasena" className="text-etiqueta font-medium text-neutro-negro-suave">
                Contraseña
              </label>
              <input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                className="px-3 py-2.5 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                           placeholder:text-neutro-gris-texto
                           focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                           transition-colors"
              />
            </div>

            {/* Selector de rol (modo mock) */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rol" className="text-etiqueta font-medium text-neutro-negro-suave">
                Acceder como <span className="text-neutro-gris-texto">(modo desarrollo)</span>
              </label>
              <select
                id="rol"
                value={rolSeleccionado}
                onChange={(e) => setRolSeleccionado(e.target.value)}
                className="px-3 py-2.5 text-cuerpo bg-marca-claro border border-marca-principal rounded-boton
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
            <a href="/restablecer-contrasena" className="text-secundario text-marca-principal hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <p className="text-center text-etiqueta text-neutro-gris-texto mt-6">
          Universidad Peruana de Ciencias Aplicadas — Tesis 2026
        </p>
      </div>
    </div>
  )
}
