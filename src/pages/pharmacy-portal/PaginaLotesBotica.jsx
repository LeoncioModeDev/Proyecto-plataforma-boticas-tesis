import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { lotes } from '@/mock-data/lotes'
import { productos } from '@/mock-data/productos'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'

/**
 * Lotes filtrados por la botica del usuario operador.
 */
export default function PaginaLotesBotica() {
  const { usuario } = useAutenticacion()
  const datos = calcularFEFO(lotes.filter(l => l.ubicacionId === usuario?.boticaId))

  const columnas = [
    { campo: 'productoId', encabezado: 'Producto', render: (r) => productos.find(p => p.id === r.productoId)?.nombreComercial || r.productoId },
    { campo: 'numeroLote', encabezado: 'Nº Lote' },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      const dias = diasRestantes(r.fechaVencimiento)
      return <span>{formatearFechaCorta(r.fechaVencimiento)} <Insignia color={dias < 30 ? 'rojo' : dias < 90 ? 'amarillo' : 'verde'}>{dias}d</Insignia></span>
    }},
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Lotes de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
