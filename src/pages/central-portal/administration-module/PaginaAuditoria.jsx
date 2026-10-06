import { useState, useEffect } from 'react'
import { Info, AlertTriangle, XCircle } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import Paginacion from '@/components/common/Paginacion'
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
  'CREAR_ORGANIZACION',
  'EDITAR_ORGANIZACION',
  'CREAR_BOTICA',
  'EDITAR_BOTICA',
  'ACTIVAR_BOTICA',
  'DESACTIVAR_BOTICA',
  'CREAR_USUARIO',
  'EDITAR_USUARIO',
  'ACTIVAR_USUARIO',
  'DESACTIVAR_USUARIO',
  'CREAR_PRODUCTO',
  'EDITAR_PRODUCTO',
  'CONFIGURAR_STOCK',
  'CREAR_TRANSFERENCIA',
  'CREAR_REDISTRIBUCION',
  'APROBAR_TRANSFERENCIA',
  'ENVIAR_TRANSFERENCIA',
  'RECIBIR_TRANSFERENCIA',
  'CANCELAR_TRANSFERENCIA',
  'RECHAZAR_TRANSFERENCIA',
  'CONFIRMAR_DEVOLUCION_ORIGEN',
  'MARCAR_OC_POR_RECIBIR',
  'REGISTRAR_RECEPCION_OC',
  'REGISTRAR_AJUSTE_INVENTARIO',
  'REGISTRAR_MERMA',
  'PROCESAR_STOCK_INICIAL',
  'VALIDAR_IMPORTACION',
  'IMPORTAR_DATOS',
  'EDITAR_CONFIGURACION',
  'CREAR_CATEGORIA_TERAPEUTICA',
  'EDITAR_CATEGORIA_TERAPEUTICA',
  'ACTIVAR_CATEGORIA_TERAPEUTICA',
  'DESACTIVAR_CATEGORIA_TERAPEUTICA',
  'APROBAR_RECOMENDACION_ML',
]

const ENTIDADES_AUDITORIA = [
  'organizaciones', 'boticas', 'usuarios', 'productos', 'stock_ubicaciones', 'transferencias', 'ordenes_compra', 'recepciones_orden', 'movimientos_inventario', 'importaciones_datos', 'configuracion_organizacion', 'categorias_terapeuticas', 'recomendaciones_ml'
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
  const [filtroEntidad, setFiltroEntidad] = useState('')
  const [fechaHoraDesde, setFechaHoraDesde] = useState('')
  const [fechaHoraHasta, setFechaHoraHasta] = useState('')
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
      if (filtroEntidad) filtros.entidad = filtroEntidad
      if (busqueda) filtros.busqueda = busqueda
      if (fechaHoraDesde) filtros.fechaDesde = new Date(fechaHoraDesde).toISOString()
      if (fechaHoraHasta) filtros.fechaHasta = new Date(fechaHoraHasta).toISOString()

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
  }, [filtroNivel, filtroAccion, filtroEntidad, busqueda, fechaHoraDesde, fechaHoraHasta])

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
          <span className="text-sm text-secundario truncate max-w-[240px]">{r.detalle}</span>
        </div>
      ),
    },
  ]

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroNivel('')
    setFiltroAccion('')
    setFiltroEntidad('')
    setFechaHoraDesde('')
    setFechaHoraHasta('')
    setPagina(1)
  }

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando registros...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Logs y Auditoría</h1>
        <p className="text-secundario mt-1">{total} registros encontrados</p>
      </div>

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar por usuario, acción, entidad..." className="w-full sm:w-80" />
        <SelectFiltro valor={filtroAccion} alCambiar={setFiltroAccion} opciones={ACCIONES_AUDITORIA.map(a => ({ valor: a, etiqueta: a }))} placeholder="Todas las acciones" />
        <SelectFiltro valor={filtroEntidad} alCambiar={setFiltroEntidad} opciones={ENTIDADES_AUDITORIA.map(e => ({ valor: e, etiqueta: e }))} placeholder="Todas las entidades" />
        <SelectFiltro valor={filtroNivel} alCambiar={setFiltroNivel} opciones={OPCIONES_NIVEL} placeholder="Todos los niveles" />
        <label className="flex flex-col gap-1 text-xs text-secundario">Fecha/hora inicial<input type="datetime-local" value={fechaHoraDesde} onChange={e => setFechaHoraDesde(e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
        <label className="flex flex-col gap-1 text-xs text-secundario">Fecha/hora final<input type="datetime-local" value={fechaHoraHasta} onChange={e => setFechaHoraHasta(e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
      </BarraFiltros>

      <Tabla columnas={columnas} datos={registros} busqueda={false} paginacion={false} alClickFila={setDetalleAbierto} />

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={total} alCambiar={setPagina} />

      <Modal abierto={!!detalleAbierto} alCerrar={() => setDetalleAbierto(null)} titulo="Detalle del Registro" tamano="md">
        {detalleAbierto && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
