import { useState } from 'react'
import { crearOrganizacion } from '@/services/supabase/crearCliente'
import { esSuperAdmin } from '@/utilities/permisos'
import useAutenticacion from '@/state/useAutenticacion'

const TIPOS_IDENTIFICACION = [
  { valor: 'ruc', etiqueta: 'RUC' },
  { valor: 'nit', etiqueta: 'NIT' },
  { valor: 'tax_id', etiqueta: 'Tax ID' },
  { valor: 'vat', etiqueta: 'VAT' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export default function CrearOrganizacion() {
  const { usuario } = useAutenticacion()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [formulario, setFormulario] = useState({
    orgNombre: '',
    orgTipoIdentificacion: 'ruc',
    orgNumeroIdentificacion: '',
    drogueriaNombre: '',
    drogueriaUbigeo: '150101',
    drogueriaDireccion: '',
    adminNombre: '',
    adminEmail: '',
    adminPassword: '',
  })

  if (!esSuperAdmin(usuario)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secundario text-lg">No tienes permisos para acceder a esta página.</p>
      </div>
    )
  }

  function actualizar(campo, valor) {
    setFormulario((prev) => ({ ...prev, [campo]: valor }))
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    setResultado(null)
    setEnviando(true)

    const { datos, error: err } = await crearOrganizacion({
      org: {
        nombre: formulario.orgNombre,
        tipo_identificacion: formulario.orgTipoIdentificacion,
        numero_identificacion: formulario.orgNumeroIdentificacion,
        drogueria: {
          nombre: formulario.drogueriaNombre || `Droguería Central - ${formulario.orgNombre}`,
          ubigeo: formulario.drogueriaUbigeo,
          direccion: formulario.drogueriaDireccion || null,
        },
      },
      admin: {
        nombre: formulario.adminNombre,
        email: formulario.adminEmail,
        password: formulario.adminPassword,
      },
    })

    setEnviando(false)

    if (err) {
      setError(err)
      return
    }

    setResultado(datos)
    setFormulario({
      orgNombre: '',
      orgTipoIdentificacion: 'ruc',
      orgNumeroIdentificacion: '',
      drogueriaNombre: '',
      drogueriaUbigeo: '150101',
      drogueriaDireccion: '',
      adminNombre: '',
      adminEmail: '',
      adminPassword: '',
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-principal mb-6">Crear Nueva Organización</h1>

      <form onSubmit={manejarEnvio} className="space-y-6">
        <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <legend className="text-lg font-semibold text-principal mb-4">Datos de la Organización</legend>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-principal mb-1">Nombre</label>
              <input type="text" value={formulario.orgNombre} onChange={(e) => actualizar('orgNombre', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="Ej: Boticas Jhodaal S.A.C." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-principal mb-1">Tipo Identificación</label>
                <select value={formulario.orgTipoIdentificacion} onChange={(e) => actualizar('orgTipoIdentificacion', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500">
                  {TIPOS_IDENTIFICACION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-principal mb-1">Número</label>
                <input type="text" value={formulario.orgNumeroIdentificacion} onChange={(e) => actualizar('orgNumeroIdentificacion', e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="20123456789" />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <legend className="text-lg font-semibold text-principal mb-4">Droguería Central</legend>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-principal mb-1">Nombre</label>
              <input type="text" value={formulario.drogueriaNombre} onChange={(e) => actualizar('drogueriaNombre', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="Droguería Central (dejar vacío para auto-generar)" />
            </div>

            <div>
              <label className="block text-sm font-medium text-principal mb-1">Dirección</label>
              <input type="text" value={formulario.drogueriaDireccion} onChange={(e) => actualizar('drogueriaDireccion', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="Av. Principal 123" />
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <legend className="text-lg font-semibold text-principal mb-4">Administrador del Cliente</legend>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-principal mb-1">Nombre Completo</label>
              <input type="text" value={formulario.adminNombre} onChange={(e) => actualizar('adminNombre', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="Ej: Carlos Mendoza" />
            </div>

            <div>
              <label className="block text-sm font-medium text-principal mb-1">Correo Electrónico</label>
              <input type="email" value={formulario.adminEmail} onChange={(e) => actualizar('adminEmail', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="admin@cliente.pe" />
            </div>

            <div>
              <label className="block text-sm font-medium text-principal mb-1">Contraseña</label>
              <input type="text" value={formulario.adminPassword} onChange={(e) => actualizar('adminPassword', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-principal focus:ring-2 focus:ring-blue-500" placeholder="Contraseña temporal" />
              <p className="text-xs text-secundario mt-1">El usuario deberá cambiar la contraseña después del primer inicio de sesión.</p>
            </div>
          </div>
        </fieldset>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {resultado && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
            <p className="text-green-700 dark:text-green-400 font-medium">Organización creada exitosamente</p>
            <div className="text-sm text-green-600 dark:text-green-300 space-y-1">
              <p><strong>Organización:</strong> {resultado.organizacion.nombre} (ID: {resultado.organizacion.id})</p>
              {resultado.drogueria_id && <p><strong>Droguería ID:</strong> {resultado.drogueria_id}</p>}
              <p><strong>Admin:</strong> {resultado.administrador.nombre} — {resultado.administrador.email}</p>
            </div>
          </div>
        )}

        <button type="submit" disabled={enviando}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors">
          {enviando ? 'Creando...' : 'Crear Organización'}
        </button>
      </form>
    </div>
  )
}
