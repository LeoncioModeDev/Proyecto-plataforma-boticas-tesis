import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import useAutenticacion from '@/estado/useAutenticacion'
import { stock } from '@/datos-prueba/stock'
import { productos } from '@/datos-prueba/productos'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilidades/clasificarAlerta'

/**
 * Stock filtrado por la botica del usuario operador.
 */
export default function PaginaStockBotica() {
  const { usuario } = useAutenticacion()
  const datos = stock.filter(s => s.ubicacionId === usuario?.boticaId).map(s => ({
    ...s,
    nombreProducto: productos.find(p => p.id === s.productoId)?.nombreComercial || s.productoId,
    estadoAlerta: clasificarAlerta(s),
  }))

  const columnas = [
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'stockDisponible', encabezado: 'Disponible' },
    { campo: 'stockMinimo', encabezado: 'Mínimo' },
    { campo: 'estadoAlerta', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO_STOCK[r.estadoAlerta]}>{ETIQUETAS_ESTADO_STOCK[r.estadoAlerta]}</Insignia> },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Stock de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
