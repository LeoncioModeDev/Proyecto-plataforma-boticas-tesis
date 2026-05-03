import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import useAutenticacion from '@/estado/useAutenticacion'
import { lotes } from '@/datos-prueba/lotes'
import { productos } from '@/datos-prueba/productos'
import { calcularFEFO } from '@/utilidades/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilidades/formatearFecha'

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
