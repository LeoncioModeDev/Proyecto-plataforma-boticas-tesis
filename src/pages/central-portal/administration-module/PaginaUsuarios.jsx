import { useState, useEffect } from 'react'
import { Users, Edit, ToggleLeft, ToggleRight, Plus, Mail, Shield, MapPin, Clock } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import { listarUsuarios, crearUsuario, actualizarUsuario, toggleUsuario } from '@/services/supabase/usuarios'
import { listarBoticas } from '@/services/supabase/boticas'
import { ETIQUETAS_ROLES } from '@/constants/roles'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { normalizarNombreCuenta } from '@/utilities/normalizarNombreCuenta'
import useConfiguracion from '@/state/useConfiguracion'

const ESTADOS_USUARIO = {
  activo: { etiqueta: 'Activo', color: 'verde' },
  inactivo: { etiqueta: 'Inactivo', color: 'gris' },
}

const MAPEO_ERRORES = {
  'No existe una droguería central en tu organización. Créala primero.':
    'No hay una droguería central en tu organización. Créala desde la sección Boticas primero.',
  'No existe una droguería central en tu organización':
    'No hay una droguería central en tu organización. Créala desde la sección Boticas primero.',
  'El operador_drogueria debe estar asociado a la droguería central':
    'No se puede crear un operador de droguería. Asegúrate de que exista una droguería central. Créala desde Boticas.',
  'Ya existe un admin_central en tu organización. Solo puede haber uno.':
    'Ya existe un administrador central. Solo puede haber uno por organización.',
  'El nombre de cuenta solo puede contener letras, números, puntos, guiones y guiones bajos. Debe empezar y terminar con letra o número.':
    'El nombre de usuario contiene caracteres inválidos.',
  'El nombre de cuenta debe tener entre 3 y 64 caracteres':
    'El nombre de usuario debe tener entre 3 y 64 caracteres.',
  'El visor_botica no puede estar asociado a la droguería central':
    'Un visor de botica no puede asociarse a la droguería central. Selecciona una botica.',
  'El rol visor_botica requiere una botica asignada':
    'El visor de botica requiere una botica asignada.',
  'La botica asignada debe pertenecer a tu organización':
    'La botica seleccionada debe pertenecer a tu organización.',
}

function mapearError(mensaje) {
  return MAPEO_ERRORES[mensaje] || mensaje
}

const COLORES_ROL = {
  admin_central: 'azul',
  operador_drogueria: 'verde',
  visor_botica: 'amarillo',
}

function formularioVacio() {
  return { nombre: '', nombreCuenta: '', rol: '', boticaId: '', telefono: '', contrasena: '', activo: true }
}

export default function PaginaUsuarios() {
  const { config, cargarConfig, obtenerDominioCorreo } = useConfiguracion()
  const [usuarios, setUsuarios] = useState([])
  const [boticas, setBoticas] = useState([])
  const [drogueria, setDrogueria] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [detalleUsuario, setDetalleUsuario] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formulario, setFormulario] = useState(formularioVacio())
  const [errorForm, setErrorForm] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [desactivando, setDesactivando] = useState(false)

  const cargarDatos = async () => {
    setCargando(true)
    setError(null)
    try {
      const [users, boticasData] = await Promise.all([
        listarUsuarios(),
        listarBoticas(),
      ])
      setUsuarios(users)
      setBoticas(boticasData.filter(b => b.tipo === 'botica'))
      const drogueriaEncontrada = boticasData.find(b => b.tipo === 'drogueria')
      setDrogueria(drogueriaEncontrada || null)
    } catch (err) {
      setError(mapearError(err.message))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos(); cargarConfig() }, [])

  const filtrados = usuarios.filter(u => {
    const matchRol = filtroRol ? u.rol === filtroRol : true
    const matchEstado = filtroEstado ? (filtroEstado === 'activo' ? u.activo : !u.activo) : true
    const matchBusqueda = busqueda
      ? u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase())
      : true
    return matchRol && matchEstado && matchBusqueda
  })

  const estadisticas = {
    total: usuarios.length,
    admins: usuarios.filter(u => u.rol === 'admin_central').length,
    operadores: usuarios.filter(u => u.rol === 'operador_drogueria').length,
    visores: usuarios.filter(u => u.rol === 'visor_botica').length,
  }

  const manejarToggleActivo = (id) => {
    const usuario = usuarios.find(u => u.id === id)
    if (usuario.activo) {
      setConfirmarDesactivar(id)
    } else {
      ejecutarToggle(id)
    }
  }

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroRol('')
    setFiltroEstado('')
  }

  const ejecutarToggle = async (id) => {
    setDesactivando(true)
    try {
      const resultado = await toggleUsuario(id)
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, activo: resultado.activo } : u))
      setExito(resultado.activo ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente')
      setTimeout(() => setExito(null), 2000)
    } catch (err) {
      setError(mapearError(err.message))
    } finally {
      setDesactivando(false)
      setConfirmarDesactivar(null)
    }
  }

  const abrirModalNuevo = () => {
    setEditando(null)
    setFormulario(formularioVacio())
    setErrorForm('')
    setModalAbierto(true)
  }

  const abrirModalEditar = (usuario) => {
    const dominio = obtenerDominioCorreo()
    const nombreCuenta = dominio && usuario.email?.endsWith(`@${dominio}`)
      ? usuario.email.slice(0, -(`@${dominio}`.length))
      : ''
    setEditando(usuario)
    setFormulario({
      nombre: usuario.nombre,
      nombreCuenta,
      rol: usuario.rol,
      boticaId: usuario.boticaId || '',
      telefono: usuario.telefono || '',
      activo: usuario.activo,
    })
    setErrorForm('')
    setModalAbierto(true)
  }

  const validarFormulario = () => {
    if (!formulario.nombre.trim()) return 'El nombre es obligatorio'
    if (!formulario.nombreCuenta.trim()) return 'El nombre de cuenta es obligatorio'
    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(formulario.nombreCuenta)) return 'El nombre de usuario contiene caracteres inválidos'
    if (!formulario.rol) return 'El rol es obligatorio'
    if (formulario.rol === 'visor_botica' && !formulario.boticaId) return 'Debe seleccionar una botica para el rol Visor'
    if (formulario.rol === 'operador_drogueria' && !drogueria) return 'No hay droguería central disponible en tu organización'
    if (!obtenerDominioCorreo()) return 'Tu organización no tiene un dominio institucional configurado. Contacta al super_admin.'
    if (!editando && !formulario.contrasena) return 'La contraseña es obligatoria'
    if (!editando && formulario.contrasena.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    return null
  }

  const guardarUsuario = async () => {
    const error = validarFormulario()
    if (error) { setErrorForm(error); return }

    setEnviando(true)
    setErrorForm('')

    try {
      const dominio = obtenerDominioCorreo()
      const emailCompleto = `${formulario.nombreCuenta}@${dominio}`
      if (editando) {
        await actualizarUsuario(editando.id, {
          nombre: formulario.nombre,
          rol: formulario.rol,
          boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : formulario.rol === 'operador_drogueria' ? drogueria?.id : null,
          telefono: formulario.telefono,
        })
        const boticaEncontrada = boticas.find(b => b.id === formulario.boticaId)
        setUsuarios(usuarios.map(u => u.id === editando.id ? {
          ...u,
          nombre: formulario.nombre,
          rol: formulario.rol,
          boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : null,
          boticaNombre: formulario.rol === 'visor_botica' ? boticaEncontrada?.nombre || u.boticaNombre : null,
          telefono: formulario.telefono,
        } : u))
        setExito('Usuario actualizado correctamente')
      } else {
        const resultado = await crearUsuario({
          nombre: formulario.nombre,
          nombreCuenta: formulario.nombreCuenta,
          rol: formulario.rol,
          boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : formulario.rol === 'operador_drogueria' ? drogueria?.id : null,
          telefono: formulario.telefono,
          contrasena: formulario.contrasena,
        })
        const boticaEncontrada = boticas.find(b => b.id === formulario.boticaId)
        const nuevo = {
          id: resultado.id,
          nombre: formulario.nombre,
          email: emailCompleto,
          rol: formulario.rol,
          boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : null,
          boticaNombre: formulario.rol === 'visor_botica' ? boticaEncontrada?.nombre || null : null,
          telefono: formulario.telefono,
          activo: true,
          ultimoAcceso: null,
          createdAt: new Date().toISOString(),
        }
        setUsuarios([nuevo, ...usuarios])
        setExito(`Usuario creado correctamente. Se envió una invitación a ${emailCompleto}`)
      }
      setModalAbierto(false)
      setTimeout(() => setExito(null), 5000)
    } catch (err) {
      setErrorForm(mapearError(err.message) || 'Error al guardar el usuario')
    } finally {
      setEnviando(false)
    }
  }

  const boticasDisponibles = boticas.filter(b => b.activa)
  const dominio = obtenerDominioCorreo()

  const columnas = [
    {
      campo: 'nombre',
      encabezado: 'Usuario',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-marca-claro rounded-full">
            <Users className="h-4 w-4 text-marca-principal" />
          </div>
          <div>
            <p className="font-medium text-principal">{r.nombre}</p>
            <div className="flex items-center gap-1 text-xs text-secundario">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[180px]">{r.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      campo: 'rol',
      encabezado: 'Rol',
      render: (r) => <Insignia color={COLORES_ROL[r.rol] || 'gris'}>{ETIQUETAS_ROLES[r.rol]}</Insignia>,
    },
    {
      campo: 'boticaNombre',
      encabezado: 'Botica Asignada',
      render: (r) => r.rol === 'visor_botica' && r.boticaNombre ? (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-secundario" />
          <span>{r.boticaNombre}</span>
        </div>
      ) : <span className="text-secundario text-sm">—</span>,
    },
    {
      campo: 'activo',
      encabezado: 'Estado',
      render: (r) => <Insignia color={ESTADOS_USUARIO[r.activo ? 'activo' : 'inactivo'].color}>{ESTADOS_USUARIO[r.activo ? 'activo' : 'inactivo'].etiqueta}</Insignia>,
    },
    {
      campo: 'ultimoAcceso',
      encabezado: 'Último Acceso',
      render: (r) => r.ultimoAcceso ? (
        <div className="flex items-center gap-1 text-sm text-secundario">
          <Clock className="h-3 w-3" />
          <span>{formatearFechaRelativa(r.ultimoAcceso)}</span>
        </div>
      ) : <span className="text-secundario text-sm">Nunca</span>,
    },
  ]

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando usuarios...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Gestión de Usuarios</h1>
          <p className="text-cuerpo text-secundario mt-1">Administración de usuarios, roles y permisos de acceso</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={abrirModalNuevo}>Nuevo Usuario</Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}
      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total Usuarios" valor={estadisticas.total} icono={Users} />
        <TarjetaMetrica etiqueta="Admin Central" valor={estadisticas.admins} icono={Shield} />
        <TarjetaMetrica etiqueta="Operadores" valor={estadisticas.operadores} icono={Users} />
        <TarjetaMetrica etiqueta="Visores" valor={estadisticas.visores} icono={MapPin} />
      </div>

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar por nombre o email..." className="w-full sm:w-80" />
        <SelectFiltro valor={filtroRol} alCambiar={setFiltroRol} opciones={[{ valor: 'admin_central', etiqueta: 'Admin Central' }, { valor: 'operador_drogueria', etiqueta: 'Operador de Droguería' }, { valor: 'visor_botica', etiqueta: 'Visor de Botica' }]} placeholder="Todos los roles" />
        <SelectFiltro valor={filtroEstado} alCambiar={setFiltroEstado} opciones={[{ valor: 'activo', etiqueta: 'Activos' }, { valor: 'inactivo', etiqueta: 'Inactivos' }]} placeholder="Todos los estados" />
      </BarraFiltros>

      <Tabla columnas={columnas} datos={filtrados} busqueda={false} alClickFila={setDetalleUsuario} />

      <Modal abierto={!!detalleUsuario} alCerrar={() => setDetalleUsuario(null)} titulo="Detalle de usuario" tamano="md">
        {detalleUsuario && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-etiqueta text-secundario">Nombre</p><p className="font-medium text-principal">{detalleUsuario.nombre}</p></div>
              <div><p className="text-etiqueta text-secundario">Email</p><p className="font-medium text-principal">{detalleUsuario.email}</p></div>
              <div><p className="text-etiqueta text-secundario">Rol</p><Insignia color={COLORES_ROL[detalleUsuario.rol] || 'gris'}>{ETIQUETAS_ROLES[detalleUsuario.rol]}</Insignia></div>
              <div><p className="text-etiqueta text-secundario">Estado</p><Insignia color={ESTADOS_USUARIO[detalleUsuario.activo ? 'activo' : 'inactivo'].color}>{ESTADOS_USUARIO[detalleUsuario.activo ? 'activo' : 'inactivo'].etiqueta}</Insignia></div>
              <div><p className="text-etiqueta text-secundario">Botica asignada</p><p className="font-medium text-principal">{detalleUsuario.boticaNombre || '—'}</p></div>
              <div><p className="text-etiqueta text-secundario">Último acceso</p><p className="font-medium text-principal">{detalleUsuario.ultimoAcceso ? formatearFechaRelativa(detalleUsuario.ultimoAcceso) : 'Nunca'}</p></div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" icono={detalleUsuario.activo ? ToggleRight : ToggleLeft} onClick={() => { setDetalleUsuario(null); manejarToggleActivo(detalleUsuario.id) }} deshabilitado={desactivando}>{detalleUsuario.activo ? 'Desactivar' : 'Activar'}</Boton>
              <Boton variante="primario" icono={Edit} onClick={() => { setDetalleUsuario(null); abrirModalEditar(detalleUsuario) }}>Editar</Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo={editando ? 'Editar Usuario' : 'Nuevo Usuario'} tamano="md">
        <div className="space-y-5">
          {errorForm && <Alerta tipo="error" titulo={errorForm} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Nombre completo <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.nombre}
                onChange={e => {
                  const nuevoNombre = e.target.value
                  const sugerencia = !editando ? normalizarNombreCuenta(nuevoNombre) : formulario.nombreCuenta
                  setFormulario({ ...formulario, nombre: nuevoNombre, nombreCuenta: !editando && !formulario.nombreCuentaEditado ? sugerencia : formulario.nombreCuenta })
                }}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Ej: Leonardo Ruiz"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Nombre de cuenta <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.nombreCuenta}
                onChange={e => setFormulario({ ...formulario, nombreCuenta: e.target.value, nombreCuentaEditado: true })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="leonardo.ruiz"
                disabled={!!editando}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Correo electrónico</label>
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-fondo-secundario border border-estilo rounded-md text-principal">
              <Mail className="h-4 w-4 text-secundario shrink-0" />
              <span className={formulario.nombreCuenta ? '' : 'text-secundario'}>
                {formulario.nombreCuenta ? `${formulario.nombreCuenta}@` : 'cuenta@'}
              </span>
              <span className="font-medium">{dominio || '— dominio no configurado —'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Contraseña <span className="text-estado-critico">*</span></label>
            <input
              type="text"
              value={formulario.contrasena}
              onChange={e => setFormulario({ ...formulario, contrasena: e.target.value })}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              placeholder="Contraseña temporal"
              disabled={!!editando}
            />
            <p className="text-xs text-secundario">El usuario usará esta contraseña para iniciar sesión.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Rol <span className="text-estado-critico">*</span></label>
              <select
                value={formulario.rol}
                onChange={e => {
                  const nuevoRol = e.target.value
                  setFormulario({
                    ...formulario,
                    rol: nuevoRol,
                    boticaId: nuevoRol === 'visor_botica' ? formulario.boticaId : '',
                  })
                }}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              >
                <option value="">Seleccionar rol...</option>
              <option value="admin_central">Admin Central</option>
              <option value="operador_drogueria">Operador Logístico Central</option>
              <option value="visor_botica">Visor Local de Botica</option>
            </select>
          </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Teléfono</label>
              <input
                type="text"
                value={formulario.telefono}
                onChange={e => setFormulario({ ...formulario, telefono: e.target.value })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="999-000-000"
              />
            </div>
          </div>

          {formulario.rol === 'visor_botica' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Botica Asignada <span className="text-estado-critico">*</span></label>
              <select
                value={formulario.boticaId}
                onChange={e => setFormulario({ ...formulario, boticaId: e.target.value })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              >
                <option value="">Seleccionar botica...</option>
                {boticasDisponibles.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {(formulario.rol === 'admin_central' || formulario.rol === 'operador_drogueria') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">
                {formulario.rol === 'admin_central' ? 'Asignación (Auto)' : 'Asignación'}
              </label>
              {drogueria ? (
                <div className="px-3 py-2 text-sm bg-fondo-secundario border border-estilo rounded-md text-principal">
                  Asignado a: <strong>{drogueria.nombre}</strong> (Droguería Central)
                </div>
              ) : (
                <div className="px-3 py-2 text-sm bg-rojo-claro border border-estado-critico rounded-md text-estado-critico">
                  No se encontró una droguería central en tu organización. Crea una primero.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={formulario.activo}
              onChange={e => setFormulario({ ...formulario, activo: e.target.checked })}
              className="rounded border-estilo"
            />
            <label htmlFor="activo" className="text-sm text-principal">Usuario activo</label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarUsuario} deshabilitado={enviando}>
              {enviando ? 'Guardando…' : editando ? 'Actualizar Usuario' : 'Crear Usuario'}
            </Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar este usuario? No podrá acceder al sistema hasta que sea activado nuevamente.</p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setConfirmarDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => ejecutarToggle(confirmarDesactivar)} deshabilitado={desactivando}>
              {desactivando ? 'Desactivando…' : 'Desactivar'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
