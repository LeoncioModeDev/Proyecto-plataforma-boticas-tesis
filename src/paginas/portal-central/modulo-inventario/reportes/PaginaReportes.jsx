import { Link } from 'react-router-dom'
import { FileSpreadsheet, AlertTriangle, ArrowLeftRight } from 'lucide-react'

/**
 * Página índice de reportes con tarjetas de acceso rápido.
 */
export default function PaginaReportes() {
  const reportes = [
    { titulo: 'Kardex por Producto', descripcion: 'Historial completo de movimientos de un producto', ruta: '/central/inventario/reportes/kardex', icono: FileSpreadsheet },
    { titulo: 'Stock Crítico', descripcion: 'Productos con stock por debajo del mínimo', ruta: '/central/inventario/reportes/stock-critico', icono: AlertTriangle },
    { titulo: 'Reporte de Movimientos', descripcion: 'Resumen de movimientos por período', ruta: '/central/inventario/reportes/movimientos', icono: ArrowLeftRight },
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Consultas y Reportes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportes.map(r => (
          <Link key={r.ruta} to={r.ruta} className="block bg-white border border-neutro-gris-borde rounded-tarjeta shadow-suave p-6 hover:border-marca-principal hover:shadow-media transition-all group">
            <r.icono className="h-8 w-8 text-marca-principal mb-3" />
            <h3 className="text-h3 text-neutro-negro group-hover:text-marca-principal transition-colors">{r.titulo}</h3>
            <p className="text-secundario text-neutro-gris-texto mt-1">{r.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
