import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import { movimientos } from '@/mock-data/movimientos'
import { productos } from '@/mock-data/productos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'

export default function PaginaAjustes() {
  const navegar = useNavigate()
  const ajustesYMermas = movimientos.filter(m => m.tipo === 'ajuste' || m.tipo === 'merma').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const columnas = [
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => productos.find(p => p.id === r.productoId)?.nombreComercial || r.productoId },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-secundario max-w-[250px] line-clamp-2">{r.motivo}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-principal">Ajustes y Mermas</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/ajustes/nuevo')}>Nuevo ajuste</Boton>
      </div>
      <Tabla columnas={columnas} datos={ajustesYMermas} />
    </div>
  )
}
