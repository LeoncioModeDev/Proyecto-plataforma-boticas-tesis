import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabla from '@/components/common/Tabla'
import Modal from '@/components/common/Modal'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import BarraFiltros from '@/components/common/BarraFiltros'

import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaMovimientosBotica() {
  const [searchParams] = useSearchParams()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    setCargando(true)
    obtenerMovimientos()
      .then(data => {
        setDatos(filtrarPorBotica(usuario, data, 'ubicacionId').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'createdAt', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="block text-etiqueta text-secundario truncate max-w-[220px]">{r.motivo}</span> },
  ]

  let filtrados = [...datos]
  const productoId = searchParams.get('productoId')
  const ubicacionId = searchParams.get('ubicacionId')
  if (productoId) filtrados = filtrados.filter(m => m.productoId === productoId)
  if (ubicacionId) filtrados = filtrados.filter(m => m.ubicacionId === ubicacionId)
  if (busqueda.trim()) filtrados = filtrados.filter(m => [m.codigoProducto, m.nombreProducto, m.motivo].some(valor => (valor || '').toLowerCase().includes(busqueda.trim().toLowerCase())))

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando movimientos...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Movimientos de mi Botica</h1>
      <BarraFiltros alLimpiar={() => setBusqueda('')}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar movimiento..." className="w-full sm:w-72" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={filtrados} busqueda={false} alClickFila={setDetalle} />
      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de movimiento" tamano="lg">
        {detalle && <div className="grid gap-3 sm:grid-cols-2 text-sm"><div><p className="text-etiqueta text-secundario">Producto</p><p className="font-medium text-principal">{detalle.nombreProducto}</p></div><div><p className="text-etiqueta text-secundario">Fecha/hora</p><p className="font-medium text-principal">{formatearFechaHora(detalle.createdAt)}</p></div><div><p className="text-etiqueta text-secundario">Cantidad</p><p className="font-medium text-principal">{detalle.cantidad}</p></div><div className="sm:col-span-2"><p className="text-etiqueta text-secundario">Motivo</p><p className="font-medium text-principal whitespace-pre-wrap">{detalle.motivo || '-'}</p></div></div>}
      </Modal>
    </div>
  )
}
