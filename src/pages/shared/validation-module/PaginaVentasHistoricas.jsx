import { BarChart3, Building2, CalendarDays, FileSpreadsheet, Package } from 'lucide-react'
import PaginaVistaValidacion from './PaginaVistaValidacion'
import { listarVentasHistoricasImportadas } from '@/services/supabase/ventasHistoricas'
import { formatearNumero, formatearSoles } from '@/utilities/formatearMoneda'
import { formatearFechaCorta, formatearFechaHora } from '@/utilities/formatearFecha'

function fecha(fechaValor) {
  if (!fechaValor) return '-'
  return formatearFechaCorta(fechaValor)
}

function fechaHora(fechaValor) {
  if (!fechaValor) return '-'
  return formatearFechaHora(fechaValor)
}

const columnas = [
  { campo: 'fecha_venta', encabezado: 'Fecha venta', render: r => fecha(r.fecha_venta) },
  { campo: 'botica', encabezado: 'Botica' },
  { campo: 'codigo_producto', encabezado: 'Codigo producto', render: r => <span className="font-mono text-xs text-secundario">{r.codigo_producto || '-'}</span> },
  { campo: 'producto', encabezado: 'Producto' },
  { campo: 'categoria_terapeutica', encabezado: 'Categoria terapeutica' },
  { campo: 'cantidad', encabezado: 'Cantidad', render: r => formatearNumero(r.cantidad) },
  { campo: 'precio_unitario', encabezado: 'Precio unitario', render: r => formatearSoles(r.precio_unitario) },
  { campo: 'importacion_id', encabezado: 'Importacion', render: r => <span className="font-mono text-xs text-secundario">{r.importacion_id || '-'}</span> },
  { campo: 'fecha_importacion', encabezado: 'Fecha importacion', render: r => fechaHora(r.fecha_importacion) },
]

export default function PaginaVentasHistoricas() {
  return (
    <PaginaVistaValidacion
      titulo="Ventas historicas importadas"
      descripcion="Validacion de ventas historicas cargadas para iniciar el sistema y alimentar el historial requerido por el modelo ML."
      columnas={columnas}
      cargarDatos={listarVentasHistoricasImportadas}
      filtrosExtra={[
        {
          nombre: 'importacionId',
          tipo: 'texto',
          placeholder: 'Filtrar por importacion',
        },
      ]}
      metricas={({ total, resumen }) => [
        { etiqueta: 'Total registros', valor: formatearNumero(total), icono: FileSpreadsheet },
        { etiqueta: 'Total unidades vendidas', valor: formatearNumero(resumen.totalUnidades || 0), icono: BarChart3 },
        { etiqueta: 'Productos con ventas', valor: formatearNumero(resumen.productosConVentas || 0), icono: Package },
        { etiqueta: 'Boticas con ventas', valor: formatearNumero(resumen.boticasConVentas || 0), icono: Building2 },
        { etiqueta: 'Rango historico', valor: resumen.rangoHistorico || 'Sin datos', icono: CalendarDays },
      ]}
      placeholderBusqueda="Buscar codigo o nombre de producto..."
    />
  )
}
