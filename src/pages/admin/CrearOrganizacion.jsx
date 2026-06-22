import { useState, useEffect } from 'react'
import { Building2, Globe, Mail, AtSign } from 'lucide-react'
import { crearOrganizacion } from '@/services/supabase/crearCliente'
import { obtenerOpcionesUbigeos } from '@/services/supabase/catalogo'
import { esSuperAdmin } from '@/utilities/permisos'
import { normalizarNombreCuenta } from '@/utilities/normalizarNombreCuenta'
import useAutenticacion from '@/state/useAutenticacion'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import CampoSeleccionUbigeo from '@/components/forms/CampoSeleccionUbigeo'

const TIPOS_IDENTIFICACION = [
  { valor: 'ruc', etiqueta: 'RUC' },
  { valor: 'nit', etiqueta: 'NIT' },
  { valor: 'tax_id', etiqueta: 'Tax ID' },
  { valor: 'vat', etiqueta: 'VAT' },
  { valor: 'otro', etiqueta: 'Otro' },
]

const PAISES = [
  { valor: 'PE', etiqueta: 'Perú' },
  { valor: 'CO', etiqueta: 'Colombia' },
  { valor: 'MX', etiqueta: 'México' },
  { valor: 'AR', etiqueta: 'Argentina' },
  { valor: 'CL', etiqueta: 'Chile' },
  { valor: 'EC', etiqueta: 'Ecuador' },
  { valor: 'BO', etiqueta: 'Bolivia' },
]

const ESTADO_INICIAL = {
  orgNombre: '',
  orgTipoIdentificacion: 'ruc',
  orgNumeroIdentificacion: '',
  orgDominioCorreo: '',
  orgPais: 'PE',
  drogueriaNombre: '',
  drogueriaUbigeo: '',
  drogueriaDireccion: '',
  drogueriaTelefono: '',
  adminNombre: '',
  adminNombreCuenta: '',
}

export default function CrearOrganizacion() {
  const { usuario } = useAutenticacion()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})
  const [formulario, setFormulario] = useState(ESTADO_INICIAL)
  const [ubigeos, setUbigeos] = useState([])

  useEffect(() => {
    obtenerOpcionesUbigeos().then(setUbigeos).catch(() => {})
  }, [])

  if (!esSuperAdmin(usuario)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secundario text-lg">No tienes permisos para acceder a esta página.</p>
      </div>
    )
  }

  function actualizar(campo, valor) {
    setFormulario((prev) => ({ ...prev, [campo]: valor }))
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  function sugerirNombreCuenta(nombreCompleto) {
    const sugerido = normalizarNombreCuenta(nombreCompleto)
    actualizar('adminNombreCuenta', sugerido)
  }

  function validar() {
    const nuevos = {}
    if (!formulario.orgNombre?.trim()) nuevos.orgNombre = 'El nombre de la organización es obligatorio'
    if (!formulario.orgNumeroIdentificacion?.trim()) nuevos.orgNumeroIdentificacion = 'El número de identificación es obligatorio'
    if (!formulario.orgDominioCorreo?.trim()) nuevos.orgDominioCorreo = 'El dominio institucional es obligatorio'
    else if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(formulario.orgDominioCorreo.toLowerCase().trim())) nuevos.orgDominioCorreo = 'Formato de dominio inválido. Ejemplo: boticasleonardo.com'
    if (!formulario.drogueriaUbigeo) nuevos.drogueriaUbigeo = 'El ubigeo de la droguería es obligatorio'
    if (!formulario.adminNombre?.trim()) nuevos.adminNombre = 'El nombre del administrador es obligatorio'
    if (!formulario.adminNombreCuenta?.trim()) nuevos.adminNombreCuenta = 'El nombre de cuenta es obligatorio'
    else if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(formulario.adminNombreCuenta)) nuevos.adminNombreCuenta = 'Solo letras, números, punto, guion o guion bajo'
    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    setResultado(null)
    if (!validar()) return
    setEnviando(true)

    const dominio = formulario.orgDominioCorreo.toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/$/, '').replace(/\/.*$/, '').replace(/\s/g, '').trim()
    const drogueriaNombre = formulario.drogueriaNombre.trim() || `Droguería Central - ${formulario.orgNombre.trim()}`

    const { datos, error: err } = await crearOrganizacion({
      organizacion: {
        nombre: formulario.orgNombre.trim(),
        tipo_identificacion: formulario.orgTipoIdentificacion,
        numero_identificacion: formulario.orgNumeroIdentificacion.trim(),
        pais_origen: formulario.orgPais,
        dominio_correo: dominio,
      },
      drogueria: {
        nombre: drogueriaNombre,
        ubigeo: formulario.drogueriaUbigeo,
        direccion: formulario.drogueriaDireccion.trim() || null,
        telefono: formulario.drogueriaTelefono.trim() || null,
      },
      administrador: {
        nombre: formulario.adminNombre.trim(),
        nombre_cuenta: formulario.adminNombreCuenta.trim(),
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

  const emailGenerado = formulario.adminNombreCuenta && formulario.orgDominioCorreo
    ? `${formulario.adminNombreCuenta}@${formulario.orgDominioCorreo.toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/$/, '').replace(/\/.*$/, '').replace(/\s/g, '').trim()}`
    : null

  const estiloInput = 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'
  const estiloSelect = 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Crear Nueva Organización</h1>
        <p className="text-cuerpo text-secundario mt-1">Registra un nuevo cliente en la plataforma</p>
      </div>

      {error && <Alerta tipo="error" titulo={error} />}
      {resultado && (
        <Alerta tipo="exito" titulo="Organización creada exitosamente">
          <div className="text-sm mt-2 space-y-1">
            <p><strong>Organización:</strong> {resultado.organizacion?.nombre} (ID: {resultado.organizacion?.id?.slice(0, 8)}…)</p>
            {resultado.drogueria?.codigo_interno && <p><strong>Droguería:</strong> {resultado.drogueria.codigo_interno} — {resultado.drogueria.nombre}</p>}
            <p><strong>Admin:</strong> {resultado.administrador?.nombre} — {resultado.administrador?.email}</p>
          </div>
        </Alerta>
      )}

      <form onSubmit={manejarEnvio} className="space-y-6">
        <Tarjeta titulo="Datos de la Organización" descripcion="Información legal y dominio institucional">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-principal">Nombre o Razón Social *</label>
              <input type="text" value={formulario.orgNombre} onChange={(e) => actualizar('orgNombre', e.target.value)} required
                className={estiloInput} placeholder="Boticas Jhodaal S.A.C." />
              {errores.orgNombre && <p className="text-xs text-estado-critico mt-1">{errores.orgNombre}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-principal">Tipo de Identificación *</label>
                <select value={formulario.orgTipoIdentificacion} onChange={(e) => actualizar('orgTipoIdentificacion', e.target.value)}
                  className={estiloSelect}>
                  {TIPOS_IDENTIFICACION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-principal">Número de Identificación *</label>
                <input type="text" value={formulario.orgNumeroIdentificacion} onChange={(e) => actualizar('orgNumeroIdentificacion', e.target.value)} required
                  className={estiloInput} placeholder="20123456789" />
                {errores.orgNumeroIdentificacion && <p className="text-xs text-estado-critico mt-1">{errores.orgNumeroIdentificacion}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-principal">País de Origen *</label>
                <select value={formulario.orgPais} onChange={(e) => actualizar('orgPais', e.target.value)}
                  className={estiloSelect}>
                  {PAISES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-principal">
                  <Globe className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                  Dominio Institucional *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-secundario text-sm">@</span>
                  <input type="text" value={formulario.orgDominioCorreo} onChange={(e) => actualizar('orgDominioCorreo', e.target.value)}
                    className={`${estiloInput} pl-8`} placeholder="boticasleonardo.com" />
                </div>
                <p className="text-xs text-secundario mt-1.5">Sin @, sin protocolo, sin espacios. Ej: boticasleonardo.com</p>
                {errores.orgDominioCorreo && <p className="text-xs text-estado-critico mt-1">{errores.orgDominioCorreo}</p>}
              </div>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Droguería Central" descripcion="Ubicación principal de almacenamiento y distribución">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-principal">Nombre de la Droguería</label>
              <input type="text" value={formulario.drogueriaNombre} onChange={(e) => actualizar('drogueriaNombre', e.target.value)}
                className={estiloInput} placeholder={`Droguería Central - ${formulario.orgNombre || 'Nombre de la organización'}`} />
              <p className="text-xs text-secundario mt-1.5">Dejar vacío para auto-generar</p>
            </div>
            <div>
              <CampoSeleccionUbigeo
                etiqueta="Ubigeo *"
                opciones={ubigeos}
                valor={formulario.drogueriaUbigeo}
                alCambiar={(v) => actualizar('drogueriaUbigeo', v)}
                requerido
              />
              {errores.drogueriaUbigeo && <p className="text-xs text-estado-critico mt-1">{errores.drogueriaUbigeo}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-principal">Dirección</label>
                <input type="text" value={formulario.drogueriaDireccion} onChange={(e) => actualizar('drogueriaDireccion', e.target.value)}
                  className={estiloInput} placeholder="Av. Principal 123" />
              </div>
              <div>
                <label className="text-sm font-medium text-principal">Teléfono</label>
                <input type="text" value={formulario.drogueriaTelefono} onChange={(e) => actualizar('drogueriaTelefono', e.target.value)}
                  className={estiloInput} placeholder="01-2345678" />
              </div>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Administrador Central" descripcion="Primer usuario administrador de la organización">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-principal">Nombre Completo *</label>
              <input type="text" value={formulario.adminNombre} onChange={(e) => {
                actualizar('adminNombre', e.target.value)
                if (!formulario.adminNombreCuentaEditado) sugerirNombreCuenta(e.target.value)
              }} required className={estiloInput} placeholder="Leonardo Ruiz" />
              {errores.adminNombre && <p className="text-xs text-estado-critico mt-1">{errores.adminNombre}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-principal">
                <AtSign className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                Nombre de Cuenta *
              </label>
              <input type="text" value={formulario.adminNombreCuenta} onChange={(e) => {
                actualizar('adminNombreCuenta', e.target.value)
                setFormulario((prev) => ({ ...prev, adminNombreCuentaEditado: true }))
              }} required className={estiloInput} placeholder="leonardo.ruiz" />
              <p className="text-xs text-secundario mt-1.5">Se combinará con el dominio institucional para generar el correo</p>
              {errores.adminNombreCuenta && <p className="text-xs text-estado-critico mt-1">{errores.adminNombreCuenta}</p>}
            </div>
            {formulario.orgDominioCorreo && (
              <div className="bg-fondo border border-estilo rounded-md p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-marca-principal" />
                  <span className="text-secundario">Correo institucional generado:</span>
                </div>
                <p className="text-sm font-mono text-principal font-medium pl-6">
                  {emailGenerado || '—'}
                </p>
                <p className="text-xs text-secundario pl-6">
                  El correo se construye automáticamente en el servidor. No se enviará contraseña — el usuario recibirá una invitación.
                </p>
              </div>
            )}
          </div>
        </Tarjeta>

        <div className="flex justify-end">
          <Boton tipo="submit" variante="primario" icono={Building2} deshabilitado={enviando} cargando={enviando}>
            {enviando ? 'Creando organización…' : 'Crear Organización'}
          </Boton>
        </div>
      </form>
    </div>
  )
}
