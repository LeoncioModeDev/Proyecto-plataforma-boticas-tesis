import { useState, useEffect } from 'react'
import { Info, AlertTriangle, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Boton from '@/components/common/Boton'
import { listarAuditoria } from '@/services/supabase/auditoria'
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

const ACCIONES_AUDITORIA = [
  'CREAR_BOTICA',
  'EDITAR_BOTICA',
  'ACTIVAR_BOTICA',
  'DESACTIVAR_BOTICA',
  'CREAR_USUARIO',
  'EDITAR_USUARIO',
  'ACTIVAR_USUARIO',
  'DESACTIVAR_USUARIO',
]

const ETIQUETAS_NIVEL_AUDITORIA = {
  info: 'Info',
  advertencia: 'Advertencia',
  error: 'Error',
}

const COLORES_NIVEL_AUDITORIA = {
  info: 'azul',
  advertencia: 'amarillo',
  error: 'rojo',
}

export default function PaginaAuditoria() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)

  const cargarRegistros = async (paginaActual = 1) => {
    setCargando(true)
    setError(null)
    try {
      const filtros = { pagina: paginaActual, limite: 50 }
      if (filtroNivel) filtros.nivel = filtroNivel
      if (filtroAccion) filtros.accion = filtroAccion
      if (busqueda) filtros.busqueda = busqueda

      const resultado = await listarAuditoria(filtros)
      setRegistros(resultado.datos)
      setTotal(resultado.total)
      setTotalPaginas(resultado.totalPaginas)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    setPagina(1)
    cargarRegistros(1)
  }, [filtroNivel, filtroAccion, busqueda])

  useEffect(() => {
    cargarRegistros(pagina)
  }, [pagina])

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id?.slice(0, 8)}</span> },
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
          {r.entidadId && <span className="text-secundario ml-1">({r.entidadId?.slice(0, 8)})</span>}
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

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando registros...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Logs y Auditoría</h1>
        <p className="text-secundario mt-1">{total} registros encontrados</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Buscar por usuario, acción, entidad..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="min-w-72 px-3 py-2 border border-estilo rounded-md text-cuerpo bg-fondo"
        />
        <select
          value={filtroNivel}
          onChange={e => setFiltroNivel(e.target.value)}
          className="px-3 py-2 border border-estilo rounded-md text-cuerpo bg-fondo"
        >
          <option value="">Todos los niveles</option>
          {OPCIONES_NIVEL.map(op => (
            <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
          ))}
        </select>
        <select
          value={filtroAccion}
          onChange={e => setFiltroAccion(e.target.value)}
          className="px-3 py-2 border border-estilo rounded-md text-cuerpo bg-fondo"
        >
          <option value="">Todas las acciones</option>
          {ACCIONES_AUDITORIA.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <Tabla columnas={columnas} datos={registros} busqueda={false} />

      {totalPaginas > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-secundario">
          <span>{total} registros en total</span>
          <div className="flex items-center gap-2">
            <span>Página {pagina} de {totalPaginas}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagina(p => p - 1)}
                disabled={pagina <= 1}
                className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={pagina >= totalPaginas}
                className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
