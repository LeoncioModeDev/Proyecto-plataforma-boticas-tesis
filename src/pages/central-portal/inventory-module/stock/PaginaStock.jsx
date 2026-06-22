import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, AlertTriangle, XCircle, TrendingUp, ClipboardList, Truck, Edit, List, Package, Settings } from 'lucide-react'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import Boton from '@/components/common/Boton'
import ModalConfigurarStock from './ModalConfigurarStock'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'

export default function PaginaStock() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [configurarStock, setConfigurarStock] = useState(null)
  const esAdminCentral = usuario?.rol === ROLES.ADMIN_CENTRAL

  useEffect(() => {
    setCargando(true)
    obtenerStockPorUbicacion()
      .then(data => {
        setDatos(data.map(s => ({ ...s, estadoAlerta: clasificarAlerta(s) })))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [])

  const ubicacionesUnicas = [...new Map(datos.map(s => [s.ubicacionId, { id: s.ubicacionId, nombre: s.nombreUbicacion }])).values()]

  let filtrados = [...datos]
  if (filtroUbicacion) filtrados = filtrados.filter(s => s.ubicacionId === filtroUbicacion)
  if (filtroEstado) filtrados = filtrados.filter(s => s.estadoAlerta === filtroEstado)

  const totalStock = filtrados.reduce((a, s) => a + s.stockDisponible, 0)
  const totalPorRecibir = filtrados.reduce((a, s) => a + (s.stockPorRecibir || 0), 0)
  const totalEnTransito = filtrados.reduce((a, s) => a + (s.stockEnTransito || 0), 0)
  const bajoStock = filtrados.filter(s => s.estadoAlerta === 'bajo').length
  const sinStock = filtrados.filter(s => s.estadoAlerta === 'sin_stock').length
  const sobrestock = filtrados.filter(s => s.estadoAlerta === 'sobrestock').length

  const manejarActualizarStock = (id, stockMinimo, stockMaximo) => {
    setDatos(prev => prev.map(d =>
      d.id === id
        ? { ...d, stockMinimo, stockMaximo, estadoAlerta: clasificarAlerta({ ...d, stockMinimo, stockMaximo }) }
        : d
    ))
  }

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
    { campo: 'stockDisponible', encabezado: 'Stock Disp.', render: (r) => (
      <span className="flex items-center gap-2">
        <span className={r.stockDisponible === 0 ? 'text-estado-critico font-semibold' : r.stockDisponible < r.stockMinimo ? 'text-estado-advertencia font-semibold' : ''}>{r.stockDisponible}</span>
        {r.stockDisponible === 0 && <XCircle className="h-4 w-4 text-estado-critico" />}
        {r.stockDisponible > 0 && r.stockDisponible < r.stockMinimo && <AlertTriangle className="h-4 w-4 text-estado-advertencia" />}
      </span>
    )},
    { campo: 'stockPorRecibir', encabezado: 'Stock Por Recibir', render: (r) => (
      <span className={r.stockPorRecibir > 0 ? 'text-marca-principal font-medium' : 'text-secundario'}>{r.stockPorRecibir ?? 0}</span>
    )},
    { campo: 'stockEnTransito', encabezado: 'Stock En Tránsito', render: (r) => (
      <span className={r.stockEnTransito > 0 ? 'text-marca-principal font-medium' : 'text-secundario'}>{r.stockEnTransito ?? 0}</span>
    )},
    { campo: 'stockMinimo', encabezado: 'Stock Mín.', render: (r) => <span>{r.stockMinimo}</span> },
    { campo: 'stockMaximo', encabezado: 'Stock Máx.', render: (r) => <span>{r.stockMaximo ?? '-'}</span> },
    { campo: 'estadoAlerta', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO_STOCK[r.estadoAlerta]}>{ETIQUETAS_ESTADO_STOCK[r.estadoAlerta]}</Insignia> },
    { campo: 'ultimaActualizacion', encabezado: 'Últ. Actualización', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaRelativa(r.ultimaActualizacion)}</span> },
    {
      campo: 'acciones', encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={() => navegar(`/central/inventario/catalogo/${r.productoId}`)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro" />
          <Boton variante="icono" icono={List} onClick={() => navegar('/central/inventario/movimientos')} title="Ver movimientos" className="text-marca-principal hover:bg-marca-claro" />
          <Boton variante="icono" icono={Package} onClick={() => navegar('/central/inventario/lotes')} title="Ver lotes" className="text-marca-principal hover:bg-marca-claro" />
          {esAdminCentral && (
            <Boton variante="icono" icono={Settings} onClick={() => setConfigurarStock(r)} title="Configurar stock" className="text-marca-principal hover:bg-marca-claro" />
          )}
        </div>
      ),
    },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando stock...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Stock y Existencias</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <TarjetaMetrica etiqueta="Stock Disponible" valor={formatearNumero(totalStock)} icono={Boxes} />
        <TarjetaMetrica etiqueta="Por Recibir" valor={formatearNumero(totalPorRecibir)} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={formatearNumero(totalEnTransito)} icono={Truck} />
        <TarjetaMetrica etiqueta="Bajo Stock" valor={bajoStock} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Sin Stock" valor={sinStock} icono={XCircle} />
        <TarjetaMetrica etiqueta="Sobrestock" valor={sobrestock} icono={TrendingUp} />
      </div>
      <div className="flex gap-4">
        <select value={filtroUbicacion} onChange={e => setFiltroUbicacion(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas las ubicaciones</option>
          {ubicacionesUnicas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los estados</option>
          <option value="normal">Normal</option><option value="bajo">Bajo Stock</option><option value="sin_stock">Sin Stock</option><option value="sobrestock">Sobrestock</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtrados} />
      <ModalConfigurarStock
        key={configurarStock?.id ?? 'cerrado'}
        abierto={!!configurarStock}
        alCerrar={() => setConfigurarStock(null)}
        producto={configurarStock}
        onActualizarStock={manejarActualizarStock}
      />
    </div>
  )
}
