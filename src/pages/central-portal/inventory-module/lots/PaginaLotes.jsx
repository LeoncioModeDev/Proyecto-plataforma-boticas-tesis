import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import { lotes } from '@/mock-data/lotes'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { calcularFEFO } from '@/utilities/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'

export default function PaginaLotes() {
  const navegar = useNavigate()
  const lotesOrdenados = calcularFEFO(lotes)
  const obtenerNombreProducto = (id) => productos.find(p => p.id === id)?.nombreComercial || id
  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => obtenerNombreProducto(r.productoId) },
    { campo: 'numeroLote', encabezado: 'Nº Lote' },
    { campo: 'ubicacionId', encabezado: 'Ubicación', render: (r) => obtenerNombreUbicacion(r.ubicacionId) },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      const dias = diasRestantes(r.fechaVencimiento)
      return <span>{formatearFechaCorta(r.fechaVencimiento)} <Insignia color={dias < 30 ? 'rojo' : dias < 90 ? 'amarillo' : 'verde'}>{dias}d</Insignia></span>
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-principal">Lotes y Vencimientos</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/lotes/nuevo')}>Registrar lote</Boton>
      </div>
      <Tabla columnas={columnas} datos={lotesOrdenados} />
    </div>
  )
}
