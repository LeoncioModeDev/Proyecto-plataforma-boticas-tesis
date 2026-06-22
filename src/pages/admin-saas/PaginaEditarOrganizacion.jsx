import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Building2, MapPin, Phone, Globe } from 'lucide-react'
import { obtenerOrganizacion, actualizarOrganizacion } from '@/services/supabase/organizaciones'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import useAutenticacion from '@/state/useAutenticacion'
import { esSuperAdmin } from '@/utilities/permisos'

const PAISES = [
  { valor: 'PE', etiqueta: 'Perú' },
  { valor: 'CO', etiqueta: 'Colombia' },
  { valor: 'MX', etiqueta: 'México' },
  { valor: 'AR', etiqueta: 'Argentina' },
  { valor: 'CL', etiqueta: 'Chile' },
  { valor: 'EC', etiqueta: 'Ecuador' },
  { valor: 'BO', etiqueta: 'Bolivia' },
]

export default function PaginaEditarOrganizacion() {
  const { usuario } = useAutenticacion()
  const { id } = useParams()
  const navegar = useNavigate()
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const [nombre, setNombre] = useState('')
  const [paisOrigen, setPaisOrigen] = useState('')
  const [drogueriaNombre, setDrogueriaNombre] = useState('')
  const [drogueriaDireccion, setDrogueriaDireccion] = useState('')
  const [drogueriaTelefono, setDrogueriaTelefono] = useState('')

  useEffect(() => {
    if (!esSuperAdmin(usuario) || !id) {
      setCargando(false)
      return
    }
    setCargando(true)
    setError('')
    obtenerOrganizacion(id)
      .then((org) => {
        setNombre(org.nombre || '')
        setPaisOrigen(org.pais_origen || 'PE')
        setDrogueriaNombre(org.drogueria?.nombre || '')
        setDrogueriaDireccion(org.drogueria?.direccion || '')
        setDrogueriaTelefono(org.drogueria?.telefono || '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [usuario, id])

  if (!esSuperAdmin(usuario)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secundario text-lg">No tienes permisos para acceder a esta página.</p>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-marca-principal border-t-transparent rounded-full" />
        <span className="ml-3 text-secundario">Cargando organización…</span>
      </div>
    )
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    setExito('')

    if (!nombre.trim()) {
      setError('El nombre de la organización es obligatorio')
      return
    }

    setEnviando(true)

    const campos = {
      nombre: nombre.trim(),
      pais_origen: paisOrigen,
    }

    if (drogueriaNombre.trim()) campos.drogueria_nombre = drogueriaNombre.trim()
    if (drogueriaDireccion.trim()) campos.drogueria_direccion = drogueriaDireccion.trim()
    else campos.drogueria_direccion = null

    if (drogueriaTelefono.trim()) campos.drogueria_telefono = drogueriaTelefono.trim()
    else campos.drogueria_telefono = null

    try {
      await actualizarOrganizacion(id, campos)
      setExito('Organización actualizada exitosamente')
      setTimeout(() => navegar(`/admin-saas/organizaciones/${id}`), 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const estiloInput = 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'
  const estiloSelect = 'w-full px-3 py-2.5 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal transition-colors'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navegar(`/admin-saas/organizaciones/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-secundario hover:text-principal transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>
      </div>

      <div>
        <h1 className="text-h1 text-principal">Editar Organización</h1>
        <p className="text-cuerpo text-secundario mt-1">Modifica los datos permitidos de la organización</p>
      </div>

      {error && <Alerta tipo="error" titulo={error} />}
      {exito && <Alerta tipo="exito" titulo={exito} />}

      <form onSubmit={manejarEnvio} className="space-y-6">
        <Tarjeta titulo="Datos de la Organización" descripcion="Información legal básica">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-principal">Nombre o Razón Social *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className={estiloInput}
                placeholder="Boticas Jhodaal S.A.C."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-principal">
                <Globe className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                País de Origen *
              </label>
              <select
                value={paisOrigen}
                onChange={(e) => setPaisOrigen(e.target.value)}
                className={estiloSelect}
              >
                {PAISES.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                ))}
              </select>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Droguería Central" descripcion="Datos de contacto de la droguería principal">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-principal">
                <Building2 className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                Nombre de la Droguería
              </label>
              <input
                type="text"
                value={drogueriaNombre}
                onChange={(e) => setDrogueriaNombre(e.target.value)}
                className={estiloInput}
                placeholder="Droguería Central"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-principal">
                  <MapPin className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                  Dirección
                </label>
                <input
                  type="text"
                  value={drogueriaDireccion}
                  onChange={(e) => setDrogueriaDireccion(e.target.value)}
                  className={estiloInput}
                  placeholder="Av. Principal 123"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-principal">
                  <Phone className="h-3.5 w-3.5 inline mr-1 text-secundario" />
                  Teléfono
                </label>
                <input
                  type="text"
                  value={drogueriaTelefono}
                  onChange={(e) => setDrogueriaTelefono(e.target.value)}
                  className={estiloInput}
                  placeholder="01-2345678"
                />
              </div>
            </div>
          </div>
        </Tarjeta>

        <div className="flex justify-end gap-3">
          <Boton
            variante="secundario"
            onClick={() => navegar(`/admin-saas/organizaciones/${id}`)}
          >
            Cancelar
          </Boton>
          <Boton
            tipo="submit"
            icono={Save}
            deshabilitado={enviando}
            cargando={enviando}
          >
            {enviando ? 'Guardando…' : 'Guardar Cambios'}
          </Boton>
        </div>
      </form>
    </div>
  )
}
