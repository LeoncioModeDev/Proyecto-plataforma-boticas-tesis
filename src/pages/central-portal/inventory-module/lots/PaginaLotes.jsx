import { useState, useEffect } from 'react'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'
export default function PaginaLotes() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroStock, setFiltroStock] = useState('con_stock')

  useEffect(() => {
    setCargando(true)
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        setDatos(calcularFEFO(data))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [])

  const datosFiltrados = datos.filter(l => {
    if (filtroStock === 'con_stock') return l.cantidad > 0
    if (filtroStock === 'agotados') return l.cantidad === 0
    return true
  })

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className={`font-mono text-xs ${r.cantidad === 0 ? 'text-secundario' : ''}`}>{r.id}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreProducto}</span> },
    { campo: 'numeroLote', encabezado: 'Nº Lote', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.numeroLote}</span> },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreUbicacion}</span> },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => r.cantidad === 0
      ? <span className="text-secundario line-through">0 <span className="not-italic text-xs">(Agotado)</span></span>
      : <span>{r.cantidad}</span>
    },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      const dias = diasRestantes(r.fechaVencimiento)
      return <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{formatearFechaCorta(r.fechaVencimiento)} <Insignia color={dias < 30 ? 'rojo' : dias < 90 ? 'amarillo' : 'verde'}>{dias}d</Insignia></span>
    }},
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando lotes...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-principal">Lotes y Vencimientos</h1>
        <select
          value={filtroStock}
          onChange={e => setFiltroStock(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
        >
          <option value="con_stock">Con stock</option>
          <option value="agotados">Agotados</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={datosFiltrados} />
    </div>
  )
}
