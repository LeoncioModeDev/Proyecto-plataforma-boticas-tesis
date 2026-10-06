import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'

import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaStockBotica() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    setCargando(true)
    obtenerStockPorUbicacion()
      .then(data => {
        const filtrados = filtrarPorBotica(usuario, data, 'ubicacionId')
        setDatos(filtrados.map(s => ({ ...s, estadoAlerta: clasificarAlerta(s) })))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
    { campo: 'stockFisico', encabezado: 'Stock Físico' },
    { campo: 'stockComprometido', encabezado: 'Stock Comprometido', render: (r) => (
      <span className={r.stockComprometido > 0 ? 'text-estado-advertencia font-medium' : 'text-secundario'}>{r.stockComprometido ?? 0}</span>
    )},
    { campo: 'stockDisponible', encabezado: 'Stock Disponible' },
    { campo: 'stockPorRecibir', encabezado: 'Stock por Recibir', render: (r) => (
      <span className={r.stockPorRecibir > 0 ? 'text-marca-principal font-medium' : 'text-secundario'}>{r.stockPorRecibir ?? 0}</span>
    )},
    { campo: 'stockEnTransito', encabezado: 'Stock en Tránsito', render: (r) => (
      <span className={r.stockEnTransito > 0 ? 'text-marca-principal font-medium' : 'text-secundario'}>{r.stockEnTransito ?? 0}</span>
    )},
    { campo: 'stockMinimo', encabezado: 'Stock Mínimo' },
    { campo: 'stockMaximo', encabezado: 'Stock Máximo', render: (r) => <span>{r.stockMaximo ?? '-'}</span> },
    { campo: 'ultimaActualizacion', encabezado: 'Últ. Actualización' },
    { campo: 'estadoAlerta', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO_STOCK[r.estadoAlerta]}>{ETIQUETAS_ESTADO_STOCK[r.estadoAlerta]}</Insignia> },
  ]

  const filtrados = busqueda.trim()
    ? datos.filter(s => [s.codigoProducto, s.nombreProducto].some(valor => (valor || '').toLowerCase().includes(busqueda.trim().toLowerCase())))
    : datos

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando stock...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Stock de mi Botica</h1>
      <BarraFiltros alLimpiar={() => setBusqueda('')}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar producto..." className="w-full sm:w-72" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={filtrados} busqueda={false} alClickFila={(r) => navegar(`/botica/stock/${r.id}`)} />
    </div>
  )
}
