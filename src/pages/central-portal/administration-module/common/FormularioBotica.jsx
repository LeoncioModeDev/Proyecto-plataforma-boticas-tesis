import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import CampoSeleccionUbigeo from '@/components/forms/CampoSeleccionUbigeo'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import Cargando from '@/components/common/Cargando'
import { crearBotica, actualizarBotica, listarBoticas } from '@/services/supabase/boticas'
import { obtenerOpcionesUbigeos } from '@/services/supabase/catalogo'
import useAutenticacion from '@/state/useAutenticacion'

export default function FormularioBotica({ boticaEditar, alGuardar }) {
  const navegar = useNavigate()
  const esEdicion = !!boticaEditar
  const { usuario } = useAutenticacion()

  const [formulario, setFormulario] = useState({
    nombre: boticaEditar?.nombre || '',
    tipo: boticaEditar?.tipo || 'botica',
    ubigeo: boticaEditar?.ubigeo || '',
    direccion: boticaEditar?.direccion || '',
    telefono: boticaEditar?.telefono || '',
    encargadoUsuarioId: boticaEditar?.encargadoUsuarioId || '',
    activa: boticaEditar?.activa ?? true,
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ubigeos, setUbigeos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tieneDrogueria, setTieneDrogueria] = useState(false)
  const [cargandoUbigeos, setCargandoUbigeos] = useState(true)
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)

  useEffect(() => {
    if (!usuario?.orgId) return
    listarBoticas().then(boticas => {
      setTieneDrogueria(boticas.some(b => b.tipo === 'drogueria'))
    }).catch(() => {})
  }, [usuario?.orgId])

  useEffect(() => {
    obtenerOpcionesUbigeos()
      .then(setUbigeos)
      .catch(() => setError('Error al cargar ubigeos'))
      .finally(() => setCargandoUbigeos(false))
  }, [])

  useEffect(() => {
    if (!usuario?.orgId) return

    import('@/services/supabase/usuarios').then(mod => {
      mod.listarUsuarios({ activos: true })
        .then(users => {
          setUsuarios(users.filter(u =>
            u.rol === 'admin_central' || u.rol === 'operador_drogueria'
          ))
        })
        .catch(() => setError('Error al cargar usuarios'))
        .finally(() => setCargandoUsuarios(false))
    })
  }, [usuario?.orgId])

  const validar = () => {
    if (!formulario.nombre.trim()) return 'El nombre es obligatorio'
    if (!formulario.direccion.trim()) return 'La dirección es obligatoria'
    return null
  }

  const alEnviar = async (e) => {
    e.preventDefault()
    const errorVal = validar()
    if (errorVal) { setError(errorVal); return }

    setEnviando(true)
    setError('')

    const datos = {
      nombre: formulario.nombre.trim(),
      tipo: formulario.tipo,
      ubigeo: formulario.ubigeo || null,
      direccion: formulario.direccion.trim(),
      telefono: formulario.telefono.trim() || null,
      encargado_usuario_id: formulario.encargadoUsuarioId || null,
      activa: formulario.activa,
    }

    try {
      if (esEdicion) {
        await actualizarBotica(boticaEditar.id, datos)
      } else {
        const resultado = await crearBotica(datos)
        datos.codigoInterno = resultado.codigoInterno
      }
      alGuardar(datos)
    } catch (err) {
      setError(err.message || 'Error al guardar la botica')
    } finally {
      setEnviando(false)
    }
  }

  const manejarCambio = (campo, valor) => {
    setFormulario(prev => ({ ...prev, [campo]: valor }))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/administracion/boticas')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{esEdicion ? 'Editar Botica' : 'Nueva Botica'}</h1>
      </div>

      {error && <Alerta tipo="error" titulo={error} />}

      <Tarjeta>
        <form onSubmit={alEnviar} className="space-y-5">
          {esEdicion && boticaEditar?.codigoInterno && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Código Interno</label>
              <input
                type="text"
                value={boticaEditar.codigoInterno}
                readOnly
                className="px-3 py-2 text-sm bg-gray-100 border border-estilo rounded-md text-principal cursor-not-allowed"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Nombre <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.nombre}
                onChange={e => manejarCambio('nombre', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Nombre de la ubicación"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Teléfono</label>
              <input
                type="text"
                value={formulario.telefono}
                onChange={e => manejarCambio('telefono', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="01-2345678"
              />
            </div>
          </div>

          {!esEdicion && !tieneDrogueria && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-principal">Tipo <span className="text-estado-critico">*</span></label>
                <select
                  value={formulario.tipo}
                  onChange={e => manejarCambio('tipo', e.target.value)}
                  className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                >
                  <option value="botica">Botica</option>
                  <option value="drogueria">Droguería</option>
                </select>
              </div>
              <div></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cargandoUbigeos ? (
              <div className="h-9 flex items-center"><Cargando tamano="pequeno" /></div>
            ) : (
              <CampoSeleccionUbigeo
                etiqueta="Distrito / Ubigeo"
                opciones={ubigeos}
                valor={formulario.ubigeo}
                alCambiar={(v) => manejarCambio('ubigeo', v)}
                requerido
              />
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Dirección <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.direccion}
                onChange={e => manejarCambio('direccion', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Av. / Calle / Jr."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Encargado</label>
              {cargandoUsuarios ? (
                <div className="h-9 flex items-center"><Cargando tamano="pequeno" /></div>
              ) : (
                <select
                  value={formulario.encargadoUsuarioId}
                  onChange={e => manejarCambio('encargadoUsuarioId', e.target.value)}
                  className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                >
                  <option value="">Sin encargado</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={formulario.activa}
                  onChange={e => manejarCambio('activa', e.target.checked)}
                  className="rounded border-estilo"
                />
                <label htmlFor="activa" className="text-sm text-principal">Ubicación activa</label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar('/central/administracion/boticas')}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} deshabilitado={enviando}>
              {enviando ? 'Guardando…' : esEdicion ? 'Actualizar Botica' : 'Crear Botica'}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
