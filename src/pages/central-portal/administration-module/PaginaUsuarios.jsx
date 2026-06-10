import { useState } from 'react'
import { Users, Edit, ToggleLeft, ToggleRight, Plus, Mail, Shield, MapPin, Clock } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { usuarios as usuariosMock, OPCIONES_USUARIO_ROL, OPCIONES_BOTICA_PARA_USUARIO } from '@/mock-data/usuarios'
import { ETIQUETAS_ROLES } from '@/constants/roles'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const ESTADOS_USUARIO = {
  activo: { etiqueta: 'Activo', color: 'verde' },
  inactivo: { etiqueta: 'Inactivo', color: 'gris' },
}

const COLORES_ROL = {
  admin_central: 'azul',
  operador_drogueria: 'verde',
  visor_botica: 'amarillo',
}

function formularioVacio() {
  return { nombre: '', email: '', rol: '', boticaId: '', telefono: '', activo: true }
}

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState(usuariosMock)
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formulario, setFormulario] = useState(formularioVacio())
  const [errorForm, setErrorForm] = useState('')

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
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, activo: true } : u))
      setExito('Usuario activado correctamente')
      setTimeout(() => setExito(null), 2000)
    }
  }

  const confirmarDesactivacion = () => {
    setUsuarios(usuarios.map(u => u.id === confirmarDesactivar ? { ...u, activo: false } : u))
    setExito('Usuario desactivado correctamente')
    setConfirmarDesactivar(null)
    setTimeout(() => setExito(null), 2000)
  }

  const abrirModalNuevo = () => {
    setEditando(null)
    setFormulario(formularioVacio())
    setErrorForm('')
    setModalAbierto(true)
  }

  const abrirModalEditar = (usuario) => {
    setEditando(usuario)
    setFormulario({
      nombre: usuario.nombre,
      email: usuario.email,
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
    if (!formulario.email.trim()) return 'El email es obligatorio'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulario.email)) return 'Email inválido'
    if (!formulario.rol) return 'El rol es obligatorio'
    if (formulario.rol === 'visor_botica' && !formulario.boticaId) return 'Debe seleccionar una botica para el rol Visor'
    return null
  }

  const guardarUsuario = () => {
    const error = validarFormulario()
    if (error) { setErrorForm(error); return }

    if (editando) {
      setUsuarios(usuarios.map(u => u.id === editando.id ? {
        ...u,
        ...formulario,
        boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : null,
      } : u))
      setExito('Usuario actualizado correctamente')
    } else {
      const nuevo = {
        id: `usr-${String(usuarios.length + 10).padStart(3, '0')}`,
        ...formulario,
        boticaId: formulario.rol === 'visor_botica' ? formulario.boticaId : null,
        avatar: null,
        ultimoAcceso: null,
        createdAt: new Date().toISOString(),
      }
      setUsuarios([...usuarios, nuevo])
      setExito('Usuario creado correctamente')
    }
    setModalAbierto(false)
    setTimeout(() => setExito(null), 2000)
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
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
      campo: 'boticaId',
      encabezado: 'Botica',
      render: (r) => {
        if (!r.boticaId) return <span className="text-secundario text-sm">—</span>
        const b = OPCIONES_BOTICA_PARA_USUARIO.find(o => o.valor === r.boticaId)
        return (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-3 w-3 text-secundario" />
            <span>{b?.etiqueta || r.boticaId}</span>
          </div>
        )
      },
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
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={() => abrirModalEditar(r)} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
          <Boton
            variante="icono"
            icono={r.activo ? ToggleRight : ToggleLeft}
            onClick={() => manejarToggleActivo(r.id)}
            title={r.activo ? 'Desactivar' : 'Activar'}
            className={r.activo ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Gestión de Usuarios</h1>
          <p className="text-cuerpo text-secundario mt-1">Administración de usuarios, roles y permisos de acceso</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={abrirModalNuevo}>Nuevo Usuario</Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total Usuarios" valor={estadisticas.total} icono={Users} />
        <TarjetaMetrica etiqueta="Admin Central" valor={estadisticas.admins} icono={Shield} />
        <TarjetaMetrica etiqueta="Operadores" valor={estadisticas.operadores} icono={Users} />
        <TarjetaMetrica etiqueta="Visores" valor={estadisticas.visores} icono={MapPin} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los roles</option>
          {OPCIONES_USUARIO_ROL.map(op => (
            <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtrados} />

      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo={editando ? 'Editar Usuario' : 'Nuevo Usuario'} tamano="md">
        <div className="space-y-5">
          {errorForm && <Alerta tipo="error" titulo={errorForm} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Nombre <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.nombre}
                onChange={e => setFormulario({ ...formulario, nombre: e.target.value })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Nombre completo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Email <span className="text-estado-critico">*</span></label>
              <input
                type="email"
                value={formulario.email}
                onChange={e => setFormulario({ ...formulario, email: e.target.value })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="correo@ejemplo.pe"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Rol <span className="text-estado-critico">*</span></label>
              <select
                value={formulario.rol}
                onChange={e => setFormulario({ ...formulario, rol: e.target.value, boticaId: e.target.value === 'visor_botica' ? formulario.boticaId : '' })}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              >
                <option value="">Seleccionar rol...</option>
                {OPCIONES_USUARIO_ROL.map(op => (
                  <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
                ))}
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
                {OPCIONES_BOTICA_PARA_USUARIO.map(op => (
                  <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
                ))}
              </select>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarUsuario}>{editando ? 'Actualizar' : 'Crear'} Usuario</Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar este usuario? No podrá acceder al sistema hasta que sea activado nuevamente.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setConfirmarDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarDesactivacion}>Desactivar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
