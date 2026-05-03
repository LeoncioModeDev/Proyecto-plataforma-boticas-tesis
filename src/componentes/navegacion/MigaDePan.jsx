import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * Breadcrumbs que muestran la jerarquía de navegación actual.
 */

const NOMBRES_RUTA = {
  central: 'Portal Central',
  dashboard: 'Dashboard',
  inventario: 'Inventario',
  catalogo: 'Catálogo',
  stock: 'Stock',
  lotes: 'Lotes',
  movimientos: 'Movimientos',
  ajustes: 'Ajustes',
  reportes: 'Reportes',
  kardex: 'Kardex',
  distribucion: 'Distribución',
  proveedores: 'Proveedores',
  botica: 'Portal Botica',
  ml: 'Panel ML',
  predicciones: 'Predicciones',
  alertas: 'Alertas',
  recomendaciones: 'Recomendaciones',
  nuevo: 'Nuevo',
}

export default function MigaDePan() {
  const ubicacion = useLocation()
  const segmentos = ubicacion.pathname.split('/').filter(Boolean)

  if (segmentos.length === 0) return null

  return (
    <nav className="flex items-center gap-1 text-secundario">
      {segmentos.map((segmento, i) => {
        const ruta = '/' + segmentos.slice(0, i + 1).join('/')
        const esUltimo = i === segmentos.length - 1
        const nombre = NOMBRES_RUTA[segmento] || segmento

        return (
          <span key={ruta} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-neutro-gris-texto" />}
            {esUltimo ? (
              <span className="text-neutro-negro font-medium">{nombre}</span>
            ) : (
              <Link to={ruta} className="text-neutro-gris-texto hover:text-marca-principal transition-colors">
                {nombre}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
