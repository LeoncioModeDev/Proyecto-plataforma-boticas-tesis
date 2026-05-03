import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import useAutenticacion from '@/estado/useAutenticacion'
import { movimientos } from '@/datos-prueba/movimientos'
import { productos } from '@/datos-prueba/productos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constantes/tiposMovimiento'
import { formatearFechaHora } from '@/utilidades/formatearFecha'

/**
 * Movimientos filtrados por la botica del usuario operador.
 */
export default function PaginaMovimientosBotica() {
  const { usuario } = useAutenticacion()
  const datos = movimientos.filter(m => m.ubicacionId === usuario?.boticaId).sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))

  const columnas = [
    { campo: 'fechaHora', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.fechaHora) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => productos.find(p => p.id === r.productoId)?.nombreComercial || r.productoId },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-neutro-gris-texto line-clamp-1">{r.motivo}</span> },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Movimientos de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
