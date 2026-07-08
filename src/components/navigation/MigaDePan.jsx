import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerPortal } from '@/utilities/permisos'

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
  transferencias: 'Transferencias',
  historial: 'Historial',
  proveedores: 'Proveedores',
  administracion: 'Administración',
  usuarios: 'Usuarios',
  boticas: 'Boticas',
  configuracion: 'Configuración',
  auditoria: 'Auditoría',
  'configuracion-avanzada': 'Config. Avanzada',
  'importacion-datos': 'Importación de Datos',
  precios: 'Precios Importados',
  'stock-historico': 'Stock Histórico Importado',
  'ventas-historicas': 'Ventas Históricas',
  botica: 'Portal Botica',
  ml: 'Panel ML',
  predicciones: 'Predicciones',
  alertas: 'Alertas',
  recomendaciones: 'Recomendaciones',
  monitoreo: 'Monitoreo',
  nuevo: 'Nuevo',
  'admin-saas': 'Admin SaaS',
  organizaciones: 'Organizaciones',
  editar: 'Editar',
}

const NOMBRES_PORTAL = {
  central: 'Portal Central',
  operaciones: 'Portal Operaciones',
  botica: 'Portal Botica',
}

export default function MigaDePan() {
  const ubicacion = useLocation()
  const { usuario } = useAutenticacion()
  const portal = obtenerPortal(usuario)
  const segmentos = ubicacion.pathname.split('/').filter(Boolean)

  if (segmentos.length === 0) return null

  const segmentosConPortal = [...segmentos]
  if (segmentos[0] === 'botica' && portal === 'botica') {
    segmentosConPortal[0] = NOMBRES_PORTAL[portal]
  } else if (segmentos[0] === 'central' && portal === 'operaciones') {
    segmentosConPortal[0] = NOMBRES_PORTAL.operaciones
  }

  return (
    <nav className="flex min-w-0 items-center gap-1 text-xs sm:text-sm text-secundario overflow-hidden">
      {segmentos.map((segmento, i) => {
        const ruta = '/' + segmentos.slice(0, i + 1).join('/')
        const esUltimo = i === segmentos.length - 1
        const esPrimero = i === 0
        const nombrePorDefecto = segmento
          .split('-')
          .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
          .join(' ')

        let nombre = NOMBRES_RUTA[segmento] || nombrePorDefecto
        if (segmento === 'historial' && i > 0 && segmentos[i - 1] === 'distribucion') {
          nombre = 'Historial de Distribución'
        }
        if (esPrimero && NOMBRES_PORTAL[segmento]) {
          nombre = NOMBRES_PORTAL[segmento]
        }

        return (
          <span key={ruta} className="flex min-w-0 items-center gap-0.5 sm:gap-1 whitespace-nowrap">
            {i > 0 && <ChevronRight className="h-3 w-3 text-secundario" />}
            {esUltimo ? (
              <span className="text-principal font-medium truncate max-w-[42vw] sm:max-w-none">{nombre}</span>
            ) : (
              <Link to={ruta} className="text-secundario hover:text-marca-principal transition-colors">
                {nombre}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
