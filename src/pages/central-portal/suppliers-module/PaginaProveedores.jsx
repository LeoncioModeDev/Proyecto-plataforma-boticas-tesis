import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, ToggleLeft, ToggleRight, Package, Mail, Phone, Clock, Building, Star } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { proveedores as proveedoresMock } from '@/mock-data/proveedores'
import { contactosProveedor as contactosMock } from '@/mock-data/contactos-proveedor'
import { condicionesComerciales as condicionesMock } from '@/mock-data/condiciones-comerciales'
import { monedas as monedasMock } from '@/mock-data/monedas'

const ESTADOS_PROVEEDOR = {
  activo: { etiqueta: 'Activo', color: 'verde' },
  inactivo: { etiqueta: 'Inactivo', color: 'gris' },
}

function obtenerContactoPrincipal(proveedorId) {
  return contactosMock.find(c => c.proveedorId === proveedorId && c.principal)
    || contactosMock.find(c => c.proveedorId === proveedorId)
}

function obtenerCondiciones(proveedorId) {
  return condicionesMock.filter(c => c.proveedorId === proveedorId)
}

const ColumnasProveedor = ({ onEditar, onToggleActivo }) => [
  { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { campo: 'codigoInterno', encabezado: 'Código Interno', render: (r) => <span className="font-mono text-xs">{r.codigoInterno}</span> },
  {
    campo: 'razonSocial',
    encabezado: 'Razón Social',
    render: (r) => {
      const contacto = obtenerContactoPrincipal(r.id)
      return (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-marca-claro rounded">
            <Building className="h-4 w-4 text-marca-principal" />
          </div>
          <div>
            <p className="font-medium text-principal">{r.razonSocial}</p>
            {contacto && <p className="text-xs text-secundario">{contacto.nombre}</p>}
          </div>
        </div>
      )
    },
  },
  {
    campo: 'numeroIdentificacion',
    encabezado: 'Identificación',
    render: (r) => (
      <div>
        <span className="font-mono text-cuerpo">{r.numeroIdentificacion}</span>
        <span className="ml-2 text-xs text-secundario">({r.tipoIdentificacion.toUpperCase()}-{r.paisOrigen})</span>
      </div>
    ),
  },
  {
    campo: 'contacto',
    encabezado: 'Contacto',
    render: (r) => {
      const contacto = obtenerContactoPrincipal(r.id)
      if (!contacto) return <span className="text-secundario">—</span>
      return (
        <div className="space-y-1">
          <p className="text-principal flex items-center gap-1">
            {contacto.nombre}
            {contacto.principal && <Star className="h-3 w-3 text-estado-exito" />}
          </p>
          {contacto.telefono && (
            <div className="flex items-center gap-1 text-xs text-secundario">
              <Phone className="h-3 w-3" />{contacto.telefono}
            </div>
          )}
          {contacto.correo && (
            <div className="flex items-center gap-1 text-xs text-secundario">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{contacto.correo}</span>
            </div>
          )}
        </div>
      )
    },
  },
  {
    campo: 'leadTime',
    encabezado: 'Lead Time',
    render: (r) => {
      const conds = obtenerCondiciones(r.id)
      const minLt = conds.length > 0 ? Math.min(...conds.map(c => c.leadTimePromedio)) : null
      return (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-secundario" />
          <span className="text-principal">{minLt ? `${minLt} días` : '—'}</span>
        </div>
      )
    },
  },
  {
    campo: 'condicionesPago',
    encabezado: 'Pago',
    render: (r) => {
      const conds = obtenerCondiciones(r.id)
      return (
        <div className="space-y-1">
          {conds.length > 0 ? conds.map(c => {
            const moneda = monedasMock.find(m => m.id === c.monedaId)
            return (
              <span key={c.id} className="text-sm text-secundario block">
                {c.plazoPago} {moneda ? `(${moneda.simbolo}${moneda.codigo})` : ''}
              </span>
            )
          }) : <span className="text-secundario">—</span>}
        </div>
      )
    },
  },
  {
    campo: 'activo',
    encabezado: 'Estado',
    render: (r) => <Insignia color={ESTADOS_PROVEEDOR[r.activo ? 'activo' : 'inactivo'].color}>{ESTADOS_PROVEEDOR[r.activo ? 'activo' : 'inactivo'].etiqueta}</Insignia>,
  },
  {
    campo: 'acciones',
    encabezado: 'Acciones',
    render: (r) => (
      <div className="flex gap-1">
        <Boton variante="icono" icono={Edit} onClick={() => onEditar(r)} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
        <Boton
          variante="icono"
          icono={r.activo ? ToggleRight : ToggleLeft}
          onClick={() => onToggleActivo(r.id)}
          title={r.activo ? 'Desactivar' : 'Activar'}
          className={r.activo ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
        />
      </div>
    ),
  },
]

export default function PaginaProveedores() {
  const navegar = useNavigate()
  const [proveedores, setProveedores] = useState(proveedoresMock)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)

  const filtrados = proveedores.filter(p => {
    const matchEstado = filtroEstado ? (filtroEstado === 'activo' ? p.activo : !p.activo) : true
    const matchBusqueda = busqueda
      ? p.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.numeroIdentificacion.includes(busqueda)
      : true
    return matchEstado && matchBusqueda
  })

  const estadisticas = {
    total: proveedores.length,
    activos: proveedores.filter(p => p.activo).length,
    inactivos: proveedores.filter(p => !p.activo).length,
  }

  const manejarEditar = (proveedor) => {
    navegar(`/central/proveedores/${proveedor.id}`)
  }

  const manejarToggleActivo = (id) => {
    const proveedor = proveedores.find(p => p.id === id)
    if (proveedor.activo) {
      setConfirmarDesactivar(id)
    } else {
      setProveedores(proveedores.map(p => p.id === id ? { ...p, activo: true } : p))
      setExito('Proveedor activado correctamente')
      setTimeout(() => setExito(null), 2000)
    }
  }

  const confirmarDesactivacion = () => {
    setProveedores(proveedores.map(p => p.id === confirmarDesactivar ? { ...p, activo: false } : p))
    setExito('Proveedor desactivado correctamente')
    setConfirmarDesactivar(null)
    setTimeout(() => setExito(null), 2000)
  }

  const columnas = ColumnasProveedor({ onEditar: manejarEditar, onToggleActivo: manejarToggleActivo })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Proveedores</h1>
          <p className="text-cuerpo text-secundario mt-1">Gestión de proveedores y condiciones comerciales</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/proveedores/nuevo')}>
          Nuevo Proveedor
        </Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Total Proveedores" valor={estadisticas.total} icono={Package} />
        <TarjetaMetrica etiqueta="Activos" valor={estadisticas.activos} icono={ToggleRight} />
        <TarjetaMetrica etiqueta="Inactivos" valor={estadisticas.inactivos} icono={ToggleLeft} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por razón social o RUC..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtrados} />

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar Desactivación">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar este proveedor? Los productos asociados no se eliminarán, pero no aparecerán en nuevas órdenes.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setConfirmarDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarDesactivacion}>Desactivar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
