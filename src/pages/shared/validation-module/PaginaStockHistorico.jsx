import { AlertTriangle, Building2, History, Package, TrendingDown } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import PaginaVistaValidacion from './PaginaVistaValidacion'
import { listarStockHistoricoImportado } from '@/services/supabase/stockHistorico'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

function fecha(fechaValor) {
  if (!fechaValor) return '-'
  return formatearFechaCorta(fechaValor)
}

const columnas = [
  { campo: 'fecha_snapshot', encabezado: 'Fecha snapshot', render: r => fecha(r.fecha_snapshot) },
  { campo: 'botica', encabezado: 'Botica' },
  { campo: 'codigo_producto', encabezado: 'Codigo producto', render: r => <span className="font-mono text-xs text-secundario">{r.codigo_producto || '-'}</span> },
  { campo: 'producto', encabezado: 'Producto' },
  { campo: 'categoria_terapeutica', encabezado: 'Categoria terapeutica' },
  { campo: 'cantidad_disponible', encabezado: 'Cantidad disponible', render: r => formatearNumero(r.cantidad_disponible) },
  { campo: 'stock_minimo', encabezado: 'Stock minimo', render: r => formatearNumero(r.stock_minimo) },
  { campo: 'stock_maximo', encabezado: 'Stock maximo', render: r => r.stock_maximo == null ? '-' : formatearNumero(r.stock_maximo) },
  { campo: 'stockout_flag', encabezado: 'Stockout', render: r => Number(r.stockout_flag) === 1 ? <Insignia color="rojo">Si</Insignia> : <Insignia color="verde">No</Insignia> },
  { campo: 'demanda_insatisfecha', encabezado: 'Demanda insatisfecha', render: r => formatearNumero(r.demanda_insatisfecha) },
]

export default function PaginaStockHistorico() {
  return (
    <PaginaVistaValidacion
      titulo="Stock historico importado"
      descripcion="Snapshots historicos de inventario usados para validar datos importados antes del analisis predictivo."
      columnas={columnas}
      cargarDatos={listarStockHistoricoImportado}
      filtrosExtra={[
        {
          nombre: 'stockout',
          placeholder: 'Stockout si/no',
          parsear: valor => valor === '' ? '' : valor === 'true',
          opciones: [
            { valor: 'true', etiqueta: 'Con stockout' },
            { valor: 'false', etiqueta: 'Sin stockout' },
          ],
        },
      ]}
      metricas={({ total, resumen }) => [
        { etiqueta: 'Snapshots', valor: formatearNumero(total || resumen.snapshots || 0), icono: History },
        { etiqueta: 'Productos', valor: formatearNumero(resumen.productos || 0), icono: Package },
        { etiqueta: 'Boticas', valor: formatearNumero(resumen.boticas || 0), icono: Building2 },
        { etiqueta: 'Semanas con stockout', valor: formatearNumero(resumen.semanasConStockout || 0), icono: AlertTriangle },
        { etiqueta: 'Demanda insatisfecha total', valor: formatearNumero(resumen.demandaInsatisfechaTotal || 0), icono: TrendingDown },
      ]}
      placeholderBusqueda="Buscar codigo o nombre de producto..."
    />
  )
}
