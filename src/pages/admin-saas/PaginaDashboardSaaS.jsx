import { useNavigate } from 'react-router-dom'
import { Building2, UserPlus, ArrowRight } from 'lucide-react'
import useAutenticacion from '@/state/useAutenticacion'

export default function PaginaDashboardSaaS() {
  const { usuario } = useAutenticacion()
  const navegar = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Panel de Administración SaaS</h1>
        <p className="text-cuerpo text-secundario mt-1">
          Bienvenido, {usuario?.nombre || 'Super Admin'}. Gestiona las organizaciones de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => navegar('/admin-saas/organizaciones/crear')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-principal text-lg">Crear Organización</span>
          </div>
          <p className="text-sm text-secundario mb-3">
            Registra una nueva organización cliente con su droguería central y usuario administrador.
          </p>
          <span className="text-sm text-marca-principal font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            Ir al formulario <ArrowRight className="h-4 w-4" />
          </span>
        </button>

        <button
          onClick={() => navegar('/admin-saas/organizaciones')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-principal text-lg">Organizaciones</span>
          </div>
          <p className="text-sm text-secundario mb-3">
            Lista, visualiza y edita las organizaciones registradas en la plataforma.
          </p>
          <span className="text-sm text-marca-principal font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            Ver listado <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  )
}
