import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { transferencias } from '@/mock-data/transferencias'
import { formatearFechaCorta } from '@/utilities/formatearFecha'
import { filtrarPorBoticaId } from '@/utilities/permisos'

const ESTADOS = {
  recibida: { etiqueta: 'Recibida', color: 'verde' },
  en_transito: { etiqueta: 'En Tránsito', color: 'azul' },
  creada: { etiqueta: 'Creada', color: 'amarillo' },
}

export default function PaginaTransferenciasBotica() {
  const { usuario } = useAutenticacion()
  const datos = filtrarPorBoticaId(usuario, transferencias, 'boticaId')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-cuerpo">{r.id.toUpperCase()}</span> },
    { campo: 'items', encabezado: 'Productos', render: (r) => <span>{r.items.length} items</span> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => {
      const info = ESTADOS[r.estado] || ESTADOS.creada
      return <Insignia color={info.color}>{info.etiqueta}</Insignia>
    }},
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Transferencias Recibidas</h1>
      <p className="text-cuerpo text-secundario">Transferencias dirigidas a mi botica</p>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
