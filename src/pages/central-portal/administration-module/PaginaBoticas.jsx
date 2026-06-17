import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Edit, ToggleLeft, ToggleRight, MapPin, Phone, Package } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { listarBoticas, toggleBotica } from '@/services/supabase/boticas'

const ESTADOS_BOTICA = {
  activa: { etiqueta: 'Activa', color: 'verde' },
  inactiva: { etiqueta: 'Inactiva', color: 'gris' },
}

const COLORES_TIPO = {
  botica: 'azul',
  drogueria: 'verde',
}

const ETIQUETAS_TIPO = {
  botica: 'Botica',
  drogueria: 'Droguería',
}

export default function PaginaBoticas() {
  const navegar = useNavigate()
  const [boticas, setBoticas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [desactivando, setDesactivando] = useState(false)

  const cargarBoticas = async () => {
    setCargando(true)
    setError(null)
    try {
      const datos = await listarBoticas()
      setBoticas(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarBoticas() }, [])

  const filtrados = boticas.filter(b => {
    const matchTipo = filtroTipo ? b.tipo === filtroTipo : true
    const matchEstado = filtroEstado ? (filtroEstado === 'activa' ? b.activa : !b.activa) : true
    const matchBusqueda = busqueda
      ? b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.encargadoVisibleNombre && b.encargadoVisibleNombre.toLowerCase().includes(busqueda.toLowerCase()))
      : true
    return matchTipo && matchEstado && matchBusqueda
  })

  const estadisticas = {
    total: boticas.length,
    droguerias: boticas.filter(b => b.tipo === 'drogueria').length,
    activas: boticas.filter(b => b.activa).length,
    inactivas: boticas.filter(b => !b.activa).length,
  }

  const manejarToggleActivo = (id) => {
    const botica = boticas.find(b => b.id === id)
    if (botica.activa) {
      setConfirmarDesactivar(id)
    } else {
      ejecutarToggle(id)
    }
  }

  const ejecutarToggle = async (id) => {
    setDesactivando(true)
    try {
      const resultado = await toggleBotica(id)
      setBoticas(boticas.map(b => b.id === id ? { ...b, activa: resultado.activa } : b))
      setExito(resultado.activa ? 'Botica activada correctamente' : 'Botica desactivada correctamente')
      setTimeout(() => setExito(null), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setDesactivando(false)
      setConfirmarDesactivar(null)
    }
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-cuerpo font-medium text-marca-principal">{r.id?.slice(0, 8)}</span> },
    { campo: 'codigoInterno', encabezado: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigoInterno}</span> },
    {
      campo: 'nombre',
      encabezado: 'Nombre',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-marca-claro rounded">
            <Building2 className="h-4 w-4 text-marca-principal" />
          </div>
          <div>
            <p className="font-medium text-principal">{r.nombre}</p>
            <div className="flex items-center gap-1 text-xs text-secundario">
              <MapPin className="h-3 w-3" />
              <span>{r.direccion}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      campo: 'tipo',
      encabezado: 'Tipo',
      render: (r) => <Insignia color={COLORES_TIPO[r.tipo] || 'gris'}>{ETIQUETAS_TIPO[r.tipo]}</Insignia>,
    },
    {
      campo: 'encargadoVisibleNombre',
      encabezado: 'Encargado',
      render: (r) => r.encargadoVisibleNombre ? (
        <span className="text-sm">
          {r.encargadoVisibleNombre}
          {r.encargadoEsFallback && <span className="text-secundario text-xs ml-1">(por defecto)</span>}
        </span>
      ) : <span className="text-secundario text-sm">—</span>,
    },
    {
      campo: 'telefono',
      encabezado: 'Teléfono',
      render: (r) => r.telefono ? (
        <div className="flex items-center gap-1 text-sm text-secundario">
          <Phone className="h-3 w-3" />
          <span>{r.telefono}</span>
        </div>
      ) : <span className="text-secundario text-sm">—</span>,
    },
    {
      campo: 'activa',
      encabezado: 'Estado',
      render: (r) => <Insignia color={ESTADOS_BOTICA[r.activa ? 'activa' : 'inactiva'].color}>{ESTADOS_BOTICA[r.activa ? 'activa' : 'inactiva'].etiqueta}</Insignia>,
    },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={() => navegar(`/central/administracion/boticas/${r.id}`)} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
          <Boton
            variante="icono"
            icono={r.activa ? ToggleRight : ToggleLeft}
            onClick={() => manejarToggleActivo(r.id)}
            title={r.activa ? 'Desactivar' : 'Activar'}
            className={r.activa ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
            deshabilitado={desactivando && confirmarDesactivar === r.id}
          />
        </div>
      ),
    },
  ]

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando boticas...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Gestión de Boticas</h1>
          <p className="text-cuerpo text-secundario mt-1">Administración de la red de boticas y droguerías</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/administracion/boticas/nueva')}>Nueva Botica</Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}
      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total Ubicaciones" valor={estadisticas.total} icono={Building2} />
        <TarjetaMetrica etiqueta="Droguerías" valor={estadisticas.droguerias} icono={Package} />
        <TarjetaMetrica etiqueta="Activas" valor={estadisticas.activas} icono={ToggleRight} />
        <TarjetaMetrica etiqueta="Inactivas" valor={estadisticas.inactivas} icono={ToggleLeft} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por nombre o encargado..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los tipos</option>
          <option value="drogueria">Droguería</option>
          <option value="botica">Botica</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="inactiva">Inactivas</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtrados} />

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar esta ubicación? Los usuarios asociados no podrán operar sobre ella.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
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
