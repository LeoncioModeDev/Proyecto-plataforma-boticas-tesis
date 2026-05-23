import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { stock } from '@/mock-data/stock'
import { productos } from '@/mock-data/productos'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaStockBotica() {
  const { usuario } = useAutenticacion()
  const datos = filtrarPorBotica(usuario, stock, 'ubicacionId').map(s => ({
    ...s,
    stockDisponible: s.cantidadDisponible,
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
      <h1 className="text-h1 text-principal">Stock de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
