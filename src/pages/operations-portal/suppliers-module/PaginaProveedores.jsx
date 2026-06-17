import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, ToggleLeft, ToggleRight, Building, Phone, Star, Mail, Coins } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { listarProveedores, toggleProveedor } from '@/services/supabase/proveedores'

function obtenerContactoPrincipal(proveedor) {
  return proveedor.contactos?.find(c => c.principal) || proveedor.contactos?.[0]
}

export default function PaginaProveedores() {
  const navegar = useNavigate()
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true)
      setError(null)
      const datos = await listarProveedores()
      setProveedores(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

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

  const manejarToggleActivo = async (id) => {
    const proveedor = proveedores.find(p => p.id === id)
    if (proveedor.activo) {
      setConfirmarDesactivar(id)
    } else {
      try {
        await toggleProveedor(id)
        setProveedores(proveedores.map(p => p.id === id ? { ...p, activo: true } : p))
        setExito('Proveedor activado correctamente')
        setTimeout(() => setExito(null), 2000)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const confirmarDesactivacion = async () => {
    try {
      await toggleProveedor(confirmarDesactivar)
      setProveedores(proveedores.map(p => p.id === confirmarDesactivar ? { ...p, activo: false } : p))
      setExito('Proveedor desactivado correctamente')
      setConfirmarDesactivar(null)
      setTimeout(() => setExito(null), 2000)
    } catch (err) {
      setError(err.message)
      setConfirmarDesactivar(null)
    }
  }

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id?.slice(0, 8)}</span> },
    {
      campo: 'razonSocial', encabezado: 'Razón Social',
      render: (r) => {
        const contacto = obtenerContactoPrincipal(r)
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
      campo: 'numeroIdentificacion', encabezado: 'Identificación',
      render: (r) => (
        <div>
          <span className="font-mono text-cuerpo">{r.numeroIdentificacion}</span>
          <span className="ml-2 text-xs text-secundario">({r.tipoIdentificacion.toUpperCase()}-{r.paisOrigen})</span>
        </div>
      ),
    },
    {
      campo: 'moneda', encabezado: 'Moneda',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-secundario" />
          {r.moneda
            ? <span>{r.moneda.simbolo} {r.moneda.codigo}</span>
            : <span className="text-secundario">—</span>}
        </div>
      ),
    },
    {
      campo: 'contacto', encabezado: 'Contacto',
      render: (r) => {
        const contacto = obtenerContactoPrincipal(r)
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
      campo: 'activo', encabezado: 'Estado',
      render: (r) => <Insignia color={r.activo ? 'verde' : 'gris'}>{r.activo ? 'Activo' : 'Inactivo'}</Insignia>,
    },
    {
      campo: 'acciones', encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={(e) => { e.stopPropagation(); navegar(`/operaciones/proveedores/${r.id}/editar`) }} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
          <Boton
            variante="icono"
            icono={r.activo ? ToggleRight : ToggleLeft}
            onClick={(e) => { e.stopPropagation(); manejarToggleActivo(r.id) }}
            title={r.activo ? 'Desactivar' : 'Activar'}
            className={r.activo ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
          />
        </div>
      ),
    },
  ]

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando proveedores...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Proveedores</h1>
          <p className="text-secundario mt-1">Gestión de proveedores de la red</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/proveedores/nuevo')}>Nuevo proveedor</Boton>
      </div>

      {error && !cargando && <Alerta tipo="error" titulo={error} className="mb-4" />}
      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Total Proveedores" valor={estadisticas.total} icono={Building} />
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

      <Tabla columnas={columnas} datos={filtrados} alClickFila={(p) => navegar(`/operaciones/proveedores/${p.id}`)} />

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
