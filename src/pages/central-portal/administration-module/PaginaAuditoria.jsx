import { useState } from 'react'
import { Info, AlertTriangle, XCircle, Search } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Tarjeta from '@/components/common/Tarjeta'
import Boton from '@/components/common/Boton'
import {
  registrosAuditoria as auditoriaMock,
  OPCIONES_ACCION_AUDITORIA,
  ETIQUETAS_NIVEL_AUDITORIA,
  COLORES_NIVEL_AUDITORIA,
} from '@/mock-data/auditoria'
import { formatearFechaHora } from '@/utilities/formatearFecha'

const ICONOS_NIVEL = {
  info: Info,
  advertencia: AlertTriangle,
  error: XCircle,
}

const OPCIONES_NIVEL = [
  { valor: 'info', etiqueta: 'Info' },
  { valor: 'advertencia', etiqueta: 'Advertencia' },
  { valor: 'error', etiqueta: 'Error' },
]

export default function PaginaAuditoria() {
  const [registros] = useState(auditoriaMock)
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [detalleAbierto, setDetalleAbierto] = useState(null)

  const filtrados = registros.filter(r => {
    const matchNivel = filtroNivel ? r.nivel === filtroNivel : true
    const matchAccion = filtroAccion ? r.accion === filtroAccion : true
    const matchBusqueda = busqueda
      ? r.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.accion.toLowerCase().includes(busqueda.toLowerCase()) ||
        (r.detalle && r.detalle.toLowerCase().includes(busqueda.toLowerCase())) ||
        (r.entidad && r.entidad.toLowerCase().includes(busqueda.toLowerCase()))
      : true
    return matchNivel && matchAccion && matchBusqueda
  })

  const columnas = [
    {
      campo: 'fecha',
      encabezado: 'Fecha y Hora',
      render: (r) => (
        <span className="text-sm text-principal font-mono">{formatearFechaHora(r.createdAt)}</span>
      ),
    },
    {
      campo: 'usuario',
      encabezado: 'Usuario',
      render: (r) => (
        <span className="text-sm font-medium text-principal">{r.usuario}</span>
      ),
    },
    {
      campo: 'accion',
      encabezado: 'Acción',
      render: (r) => (
        <span className="text-sm text-principal">{r.accion}</span>
      ),
    },
    {
      campo: 'entidad',
      encabezado: 'Entidad',
      render: (r) => r.entidad ? (
        <div className="text-sm">
          <span className="text-principal">{r.entidad}</span>
          {r.entidadId && <span className="text-secundario ml-1">({r.entidadId})</span>}
        </div>
      ) : <span className="text-secundario text-sm">—</span>,
    },
    {
      campo: 'nivel',
      encabezado: 'Nivel',
      render: (r) => {
        const Icono = ICONOS_NIVEL[r.nivel] || Info
        return (
          <div className="flex items-center gap-1">
            <Icono className={`h-3.5 w-3.5 ${
              r.nivel === 'error' ? 'text-estado-critico' :
              r.nivel === 'advertencia' ? 'text-estado-advertencia' :
              'text-estado-info'
            }`} />
            <Insignia color={COLORES_NIVEL_AUDITORIA[r.nivel] || 'gris'}>
              {ETIQUETAS_NIVEL_AUDITORIA[r.nivel]}
            </Insignia>
          </div>
        )
      },
    },
    {
      campo: 'detalle',
      encabezado: 'Detalle',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-sm text-secundario line-clamp-1 max-w-[200px]">{r.detalle}</span>
          <Boton variante="icono" icono={Search} onClick={() => setDetalleAbierto(r)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro shrink-0" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Logs y Auditoría</h1>
        <p className="text-cuerpo text-secundario mt-1">Historial de actividades, cambios y eventos del sistema</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por usuario, acción, entidad..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario focus:outline-none focus:ring-2 focus:ring-marca-principal"
        />
        <select
          value={filtroNivel}
          onChange={e => setFiltroNivel(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los niveles</option>
          {OPCIONES_NIVEL.map(op => (
            <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
          ))}
        </select>
        <select
          value={filtroAccion}
          onChange={e => setFiltroAccion(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-md text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todas las acciones</option>
          {OPCIONES_ACCION_AUDITORIA.map(op => (
            <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
          ))}
        </select>
      </div>

      <Tarjeta>
        <Tabla columnas={columnas} datos={filtrados} busqueda={false} />
      </Tarjeta>

      <Modal abierto={!!detalleAbierto} alCerrar={() => setDetalleAbierto(null)} titulo="Detalle del Registro" tamano="md">
        {detalleAbierto && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Fecha y Hora</p>
                <p className="text-sm font-medium text-principal">{formatearFechaHora(detalleAbierto.createdAt)}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Nivel</p>
                <Insignia color={COLORES_NIVEL_AUDITORIA[detalleAbierto.nivel] || 'gris'}>
                  {ETIQUETAS_NIVEL_AUDITORIA[detalleAbierto.nivel]}
                </Insignia>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Usuario</p>
                <p className="text-sm font-medium text-principal">{detalleAbierto.usuario}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Acción</p>
                <p className="text-sm font-medium text-principal">{detalleAbierto.accion}</p>
              </div>
              {detalleAbierto.entidad && (
                <div className="p-3 bg-fondo rounded-md">
                  <p className="text-xs text-secundario mb-1">Entidad</p>
                  <p className="text-sm font-medium text-principal">{detalleAbierto.entidad}</p>
                </div>
              )}
              {detalleAbierto.entidadId && (
                <div className="p-3 bg-fondo rounded-md">
                  <p className="text-xs text-secundario mb-1">ID Entidad</p>
                  <p className="text-sm font-medium text-principal font-mono">{detalleAbierto.entidadId}</p>
                </div>
              )}
            </div>
            <div className="p-3 bg-fondo rounded-md">
              <p className="text-xs text-secundario mb-1">Detalle</p>
              <p className="text-sm text-principal">{detalleAbierto.detalle}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
