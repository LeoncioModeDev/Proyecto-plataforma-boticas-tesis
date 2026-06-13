import { useState } from 'react'
import { Building2, UserPlus, ShieldCheck, User, Key, MapPin, Phone } from 'lucide-react'
import { crearOrganizacion } from '@/services/supabase/crearCliente'
import { esSuperAdmin } from '@/utilities/permisos'
import useAutenticacion from '@/state/useAutenticacion'
import Boton from '@/components/common/Boton'

const TIPOS_IDENTIFICACION = [
  { valor: 'ruc', etiqueta: 'RUC' },
  { valor: 'nit', etiqueta: 'NIT' },
  { valor: 'tax_id', etiqueta: 'Tax ID' },
  { valor: 'vat', etiqueta: 'VAT' },
  { valor: 'otro', etiqueta: 'Otro' },
]

const ESTADO_INICIAL = {
  orgNombre: '',
  orgTipoIdentificacion: 'ruc',
  orgNumeroIdentificacion: '',
  drogueriaNombre: '',
  drogueriaDireccion: '',
  drogueriaTelefono: '',
  adminNombre: '',
  adminEmail: '',
  adminPassword: '',
}

function Campo({ etiqueta, icono: Icono, error, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-principal mb-1.5">
        {Icono && <Icono className="h-3.5 w-3.5 text-secundario" />}
        {etiqueta}
      </label>
      {children}
      {error && <p className="text-xs text-estado-critico mt-1">{error}</p>}
    </div>
  )
}

export default function CrearOrganizacion() {
  const { usuario } = useAutenticacion()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [formulario, setFormulario] = useState(ESTADO_INICIAL)

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
          direccion: formulario.drogueriaDireccion || null,
          telefono: formulario.drogueriaTelefono || null,
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
    setFormulario(ESTADO_INICIAL)
  }

  function estiloInput() {
    return 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'
  }

  function estiloSelect() {
    return 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-marca-principal rounded-xl flex items-center justify-center">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-h2 text-principal font-semibold">Crear Nueva Organización</h1>
          <p className="text-secundario text-sm">Registra un nuevo cliente en la plataforma</p>
        </div>
      </div>

      <form onSubmit={manejarEnvio} className="space-y-6">
        <div className="bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-estilo-suave">
            <Building2 className="h-4 w-4 text-marca-principal" />
            <h2 className="text-h3 text-principal font-semibold">Datos de la Organización</h2>
          </div>

          <Campo etiqueta="Nombre de la organización" icono={Building2}>
            <input type="text" value={formulario.orgNombre} onChange={(e) => actualizar('orgNombre', e.target.value)} required
              className={estiloInput()} placeholder="Ej: Boticas Jhodaal S.A.C." />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Tipo de identificación">
              <select value={formulario.orgTipoIdentificacion} onChange={(e) => actualizar('orgTipoIdentificacion', e.target.value)}
                className={estiloSelect()}>
                {TIPOS_IDENTIFICACION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Número de identificación">
              <input type="text" value={formulario.orgNumeroIdentificacion} onChange={(e) => actualizar('orgNumeroIdentificacion', e.target.value)} required
                className={estiloInput()} placeholder="20123456789" />
            </Campo>
          </div>
        </div>

        <div className="bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-estilo-suave">
            <MapPin className="h-4 w-4 text-marca-principal" />
            <h2 className="text-h3 text-principal font-semibold">Droguería Central</h2>
          </div>

          <Campo etiqueta="Nombre" icono={Building2}>
            <input type="text" value={formulario.drogueriaNombre} onChange={(e) => actualizar('drogueriaNombre', e.target.value)}
              className={estiloInput()} placeholder="Dejar vacío para auto-generar" />
          </Campo>

          <Campo etiqueta="Dirección" icono={MapPin}>
            <input type="text" value={formulario.drogueriaDireccion} onChange={(e) => actualizar('drogueriaDireccion', e.target.value)}
              className={estiloInput()} placeholder="Av. Principal 123" />
          </Campo>

          <Campo etiqueta="Teléfono" icono={Phone}>
            <input type="text" value={formulario.drogueriaTelefono} onChange={(e) => actualizar('drogueriaTelefono', e.target.value)}
              className={estiloInput()} placeholder="01-2345678" />
          </Campo>
        </div>

        <div className="bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-estilo-suave">
            <ShieldCheck className="h-4 w-4 text-marca-principal" />
            <h2 className="text-h3 text-principal font-semibold">Administrador del Cliente</h2>
          </div>

          <Campo etiqueta="Nombre completo" icono={User}>
            <input type="text" value={formulario.adminNombre} onChange={(e) => actualizar('adminNombre', e.target.value)} required
              className={estiloInput()} placeholder="Ej: Carlos Mendoza" />
          </Campo>

          <Campo etiqueta="Correo electrónico" icono={UserPlus}>
            <input type="email" value={formulario.adminEmail} onChange={(e) => actualizar('adminEmail', e.target.value)} required
              className={estiloInput()} placeholder="admin@cliente.pe" />
          </Campo>

          <Campo etiqueta="Contraseña temporal" icono={Key}>
            <input type="text" value={formulario.adminPassword} onChange={(e) => actualizar('adminPassword', e.target.value)} required
              className={estiloInput()} placeholder="••••••••" />
            <p className="text-xs text-secundario mt-1.5">El usuario deberá cambiar la contraseña después del primer inicio de sesión.</p>
          </Campo>
        </div>

        {error && (
          <div className="bg-estado-critico-fondo border border-estado-critico/20 rounded-lg p-4 text-estado-critico text-sm">
            {error}
          </div>
        )}

        {resultado && (
          <div className="bg-marca-claro border border-marca-principal/20 rounded-lg p-4 space-y-2">
            <p className="text-marca-principal font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Organización creada exitosamente
            </p>
            <div className="text-sm text-marca-oscuro space-y-1">
              <p><strong>Organización:</strong> {resultado.organizacion.nombre} (ID: {resultado.organizacion.id?.slice(0, 8)}…)</p>
              {resultado.drogueria_id && <p><strong>Droguería ID:</strong> {resultado.drogueria_id?.slice(0, 8)}…</p>}
              <p><strong>Admin:</strong> {resultado.administrador.nombre} — {resultado.administrador.email}</p>
            </div>
          </div>
        )}

        <Boton tipo="submit" variante="primario" tamano="grande" icono={Building2} className="w-full" deshabilitado={enviando} cargando={enviando}>
          {enviando ? 'Creando organización…' : 'Crear Organización'}
        </Boton>
      </form>
    </div>
  )
}
