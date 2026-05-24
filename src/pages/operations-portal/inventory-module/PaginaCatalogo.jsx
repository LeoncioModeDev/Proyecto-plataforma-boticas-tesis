import { useState } from 'react'
import { Plus, Edit } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import { productos as productosMock } from '@/mock-data/productos'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [productos] = useState(productosMock)

  const columnas = [
    { campo: 'nombreComercial', encabezado: 'Nombre Comercial' },
    { campo: 'principioActivo', encabezado: 'Principio Activo' },
    { campo: 'formaFarmaceutica', encabezado: 'Forma', render: (r) => <span className="capitalize">{r.formaFarmaceutica}</span> },
    { campo: 'concentracion', encabezado: 'Concentración' },
    { campo: 'laboratorio', encabezado: 'Laboratorio' },
    { campo: 'clasificacion', encabezado: 'Clasificación', render: (r) => <Insignia color={COLORES_CLASIFICACION[r.clasificacion]}>{ETIQUETAS_CLASIFICACION[r.clasificacion]}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO[r.estado]}>{ETIQUETAS_ESTADO[r.estado]}</Insignia> },
    {
      campo: 'acciones', encabezado: 'Acciones',
      render: (r) => (
        <Boton variante="icono" icono={Edit} onClick={() => navegar(`/operaciones/inventario/catalogo/${r.id}`)} title="Ver detalle" />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Catálogo de Productos</h1>
          <p className="text-secundario mt-1">Gestión global del catálogo de la red</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/inventario/catalogo/nuevo')}>Nuevo producto</Boton>
      </div>
      <Tabla columnas={columnas} datos={productos} />
    </div>
  )
}
