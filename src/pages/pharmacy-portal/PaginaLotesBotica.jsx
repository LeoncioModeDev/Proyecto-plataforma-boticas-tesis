import { useState, useEffect } from 'react'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import useConfiguracion from '@/state/useConfiguracion'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaLotesBotica() {
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroStock, setFiltroStock] = useState('con_stock')
  const alertaDias = useConfiguracion(s => s.config?.alertaVencimientoDias ?? 30)

  useEffect(() => {
    setCargando(true)
    obtenerLotesActivos(undefined, undefined, undefined, false)
      .then(data => {
        setDatos(calcularFEFO(filtrarPorBotica(usuario, data, 'ubicacionId')))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const datosFiltrados = datos.filter(l => {
    if (filtroStock === 'con_stock') return l.cantidad > 0
    if (filtroStock === 'agotados') return l.cantidad === 0
    return true
  })

  const columnas = [
    { campo: 'numeroLote', encabezado: 'Nº Lote', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.numeroLote}</span> },
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className={`font-mono text-xs ${r.cantidad === 0 ? 'text-secundario' : ''}`}>{r.codigoProducto || '-'}</span> },
    { campo: 'nombreProducto', encabezado: 'Producto', render: (r) => <span className={r.cantidad === 0 ? 'text-secundario' : ''}>{r.nombreProducto}</span> },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => r.cantidad === 0
      ? <span className="text-secundario line-through">0 <span className="not-italic text-xs">(Agotado)</span></span>
      : <span>{r.cantidad}</span>
    },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      if (r.cantidad === 0) {
        return <span className="text-secundario">{formatearFechaCorta(r.fechaVencimiento)}</span>
      }
      const dias = diasRestantes(r.fechaVencimiento)
      let color, etiqueta
      if (dias < 0) { color = 'rojo'; etiqueta = 'Vencido' }
      else if (dias <= alertaDias) { color = 'amarillo'; etiqueta = 'Próx. vencer' }
      else { color = 'verde'; etiqueta = 'Vigente' }
      return <span>{formatearFechaCorta(r.fechaVencimiento)} <Insignia color={color}>{etiqueta}</Insignia></span>
    }},
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando lotes...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1 text-principal">Lotes de mi Botica</h1>
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
