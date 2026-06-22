import { useState, useEffect } from 'react'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO, OPCIONES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'

export default function PaginaMovimientos() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')

  useEffect(() => {
    setCargando(true)
    obtenerMovimientos()
      .then(data => {
        setDatos(data)
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [])

  let filtrados = [...datos]
  if (filtroTipo) filtrados = filtrados.filter(m => m.tipo === filtroTipo)

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'createdAt', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => <span className={r.tipo === 'entrada' ? 'text-marca-principal font-semibold' : 'text-estado-critico font-semibold'}>{r.tipo === 'entrada' ? '+' : '-'}{Math.abs(r.cantidad)}</span> },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-secundario line-clamp-1 max-w-[200px]">{r.motivo}</span> },
    { campo: 'nombreUsuario', encabezado: 'Usuario' },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando movimientos...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Kardex - Movimientos de Inventario</h1>
          <p className="text-secundario mt-1">Historial de movimientos generados automáticamente por órdenes de compra, transferencias, ajustes y mermas. Solo consulta.</p>
        </div>
      </div>
      <div className="flex gap-4">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los tipos</option>
          {OPCIONES_MOVIMIENTO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtrados} />
    </div>
  )
}
