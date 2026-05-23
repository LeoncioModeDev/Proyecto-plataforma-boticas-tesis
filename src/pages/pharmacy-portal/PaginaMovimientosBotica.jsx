import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { movimientos } from '@/mock-data/movimientos'
import { productos } from '@/mock-data/productos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaMovimientosBotica() {
  const { usuario } = useAutenticacion()
  const datos = filtrarPorBotica(usuario, movimientos, 'ubicacionId').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const columnas = [
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => productos.find(p => p.id === r.productoId)?.nombreComercial || r.productoId },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) =>             <span className="text-etiqueta text-secundario line-clamp-1">{r.motivo}</span> },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Movimientos de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
