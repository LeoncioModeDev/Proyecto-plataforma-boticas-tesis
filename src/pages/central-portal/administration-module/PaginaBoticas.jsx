import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Edit, ToggleLeft, ToggleRight, MapPin, Phone, User, Package } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { boticas as boticasMock, OPCIONES_TIPO_BOTICA } from '@/mock-data/boticas'

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
  const [boticas, setBoticas] = useState(boticasMock)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)

  const filtrados = boticas.filter(b => {
    const matchTipo = filtroTipo ? b.tipo === filtroTipo : true
    const matchEstado = filtroEstado ? (filtroEstado === 'activa' ? b.activa : !b.activa) : true
    const matchBusqueda = busqueda
      ? b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        b.distrito.toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.encargado && b.encargado.toLowerCase().includes(busqueda.toLowerCase()))
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
      setBoticas(boticas.map(b => b.id === id ? { ...b, activa: true } : b))
      setExito('Botica activada correctamente')
      setTimeout(() => setExito(null), 2000)
    }
  }

  const confirmarDesactivacion = () => {
    setBoticas(boticas.map(b => b.id === confirmarDesactivar ? { ...b, activa: false } : b))
    setExito('Botica desactivada correctamente')
    setConfirmarDesactivar(null)
    setTimeout(() => setExito(null), 2000)
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { campo: 'codigoInterno', encabezado: 'Código Interno', render: (r) => <span className="font-mono text-xs">{r.codigoInterno}</span> },
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
              <span>{r.distrito}</span>
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
      campo: 'encargado',
      encabezado: 'Encargado',
      render: (r) => r.encargado ? (
        <div className="flex items-center gap-1 text-sm">
          <User className="h-3 w-3 text-secundario" />
          <span>{r.encargado}</span>
        </div>
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
          />
        </div>
      ),
    },
  ]

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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total Ubicaciones" valor={estadisticas.total} icono={Building2} />
        <TarjetaMetrica etiqueta="Droguerías" valor={estadisticas.droguerias} icono={Package} />
        <TarjetaMetrica etiqueta="Activas" valor={estadisticas.activas} icono={ToggleRight} />
        <TarjetaMetrica etiqueta="Inactivas" valor={estadisticas.inactivas} icono={ToggleLeft} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por nombre, distrito o encargado..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los tipos</option>
          {OPCIONES_TIPO_BOTICA.map(op => (
            <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
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
            <Boton variante="peligro" onClick={confirmarDesactivacion}>Desactivar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
