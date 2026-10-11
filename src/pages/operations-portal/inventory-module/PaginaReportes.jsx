import { Link } from 'react-router-dom'
import { FileSpreadsheet, AlertTriangle, ArrowLeftRight, RotateCw } from 'lucide-react'

export default function PaginaReportes() {
  const reportes = [
    { titulo: 'Kardex por Producto', descripcion: 'Historial completo de movimientos de un producto', ruta: '/operaciones/inventario/reportes/kardex', icono: FileSpreadsheet },
    { titulo: 'Stock Crítico', descripcion: 'Productos con stock por debajo del mínimo', ruta: '/operaciones/inventario/reportes/stock-critico', icono: AlertTriangle },
    { titulo: 'Reporte de Movimientos', descripcion: 'Resumen de movimientos por período', ruta: '/operaciones/inventario/reportes/movimientos', icono: ArrowLeftRight },
    { titulo: 'Rotación de Inventario', descripcion: 'Índice de rotación por producto y botica', ruta: '/operaciones/inventario/reportes/rotacion', icono: RotateCw },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Consultas y Reportes</h1>
      <p className="text-secundario mt-1">Reportes operativos de la red de boticas</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportes.map(r => (
          <Link key={r.ruta} to={r.ruta} className="block bg-fondo-secundario border border-estilo rounded-lg shadow-estilo p-6 hover:border-marca-principal transition-all group">
            <r.icono className="h-8 w-8 text-marca-principal mb-3" />
            <h3 className="text-h3 text-principal group-hover:text-marca-principal transition-colors">{r.titulo}</h3>
            <p className="text-secundario mt-1">{r.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
