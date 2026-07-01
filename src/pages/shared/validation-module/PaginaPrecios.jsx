import { Package, Building2, Percent, CalendarClock } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import PaginaVistaValidacion from './PaginaVistaValidacion'
import { listarPreciosImportados } from '@/services/supabase/precios'
import { formatearSoles } from '@/utilities/formatearMoneda'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

function fecha(fechaValor) {
  if (!fechaValor) return '-'
  return formatearFechaCorta(fechaValor)
}

const COLORES_ESTADO = {
  Vigente: 'verde',
  Vencido: 'rojo',
  Programado: 'azul',
}

const columnas = [
  { campo: 'botica', encabezado: 'Botica' },
  { campo: 'codigo_producto', encabezado: 'Codigo producto', render: r => <span className="font-mono text-xs text-secundario">{r.codigo_producto || '-'}</span> },
  { campo: 'producto', encabezado: 'Producto' },
  { campo: 'categoria_terapeutica', encabezado: 'Categoria terapeutica' },
  { campo: 'precio_venta', encabezado: 'Precio venta', render: r => formatearSoles(r.precio_venta) },
  { campo: 'precio_costo', encabezado: 'Precio costo', render: r => formatearSoles(r.precio_costo) },
  { campo: 'margen', encabezado: 'Margen', render: r => <span className={Number(r.margen) < 0 ? 'text-estado-critico font-semibold' : 'text-principal'}>{formatearSoles(r.margen)}</span> },
  { campo: 'vigente_desde', encabezado: 'Vigente desde', render: r => fecha(r.vigente_desde) },
  { campo: 'vigente_hasta', encabezado: 'Vigente hasta', render: r => fecha(r.vigente_hasta) },
  { campo: 'estado_vigencia', encabezado: 'Estado vigencia', render: r => <Insignia color={COLORES_ESTADO[r.estado_vigencia] || 'gris'}>{r.estado_vigencia}</Insignia> },
]

export default function PaginaPrecios() {
  return (
    <PaginaVistaValidacion
      titulo="Precios importados"
      descripcion="Validacion de precios de venta y costo cargados por botica y producto. No incluye precio referencial de proveedor."
      columnas={columnas}
      cargarDatos={listarPreciosImportados}
      filtrosExtra={[
        {
          nombre: 'estadoVigencia',
          placeholder: 'Todos los estados de vigencia',
          opciones: [
            { valor: 'Vigente', etiqueta: 'Vigente' },
            { valor: 'Vencido', etiqueta: 'Vencido' },
            { valor: 'Programado', etiqueta: 'Programado' },
          ],
        },
      ]}
      metricas={({ total, datos }) => [
        { etiqueta: 'Registros visibles', valor: total, icono: Package },
        { etiqueta: 'Boticas', valor: new Set(datos.map(d => d.botica_id).filter(Boolean)).size, icono: Building2 },
        { etiqueta: 'Productos', valor: new Set(datos.map(d => d.producto_id).filter(Boolean)).size, icono: Package },
        { etiqueta: 'Vigentes', valor: datos.filter(d => d.estado_vigencia === 'Vigente').length, icono: CalendarClock },
        { etiqueta: 'Margen promedio', valor: formatearSoles(datos.length ? datos.reduce((acc, d) => acc + Number(d.margen || 0), 0) / datos.length : 0), icono: Percent },
      ]}
      placeholderBusqueda="Buscar codigo o nombre de producto..."
    />
  )
}
