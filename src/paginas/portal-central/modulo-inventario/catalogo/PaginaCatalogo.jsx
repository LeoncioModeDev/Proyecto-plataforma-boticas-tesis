import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import CampoSeleccion from '@/componentes/formularios/CampoSeleccion'
import { productos } from '@/datos-prueba/productos'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION, OPCIONES_CLASIFICACION } from '@/constantes/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constantes/estadoProducto'

/**
 * Página principal del catálogo de productos.
 */
export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [filtroClasificacion, setFiltroClasificacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  let datosFiltrados = [...productos]
  if (filtroClasificacion) datosFiltrados = datosFiltrados.filter(p => p.clasificacion === filtroClasificacion)
  if (filtroEstado) datosFiltrados = datosFiltrados.filter(p => p.estado === filtroEstado)

  const columnas = [
    { campo: 'nombreComercial', encabezado: 'Nombre Comercial' },
    { campo: 'principioActivo', encabezado: 'Principio Activo' },
    { campo: 'formaFarmaceutica', encabezado: 'Forma', render: (r) => <span className="capitalize">{r.formaFarmaceutica}</span> },
    { campo: 'concentracion', encabezado: 'Concentración' },
    { campo: 'laboratorio', encabezado: 'Laboratorio' },
    { campo: 'clasificacion', encabezado: 'Clasificación', render: (r) => <Insignia color={COLORES_CLASIFICACION[r.clasificacion]}>{ETIQUETAS_CLASIFICACION[r.clasificacion]}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO[r.estado]}>{ETIQUETAS_ESTADO[r.estado]}</Insignia> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-neutro-negro">Catálogo de Productos</h1>
          <p className="text-secundario text-neutro-gris-texto mt-1">{datosFiltrados.length} productos encontrados</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/catalogo/nuevo')}>
          Agregar producto
        </Boton>
      </div>
      <div className="flex gap-4">
        <select value={filtroClasificacion} onChange={e => setFiltroClasificacion(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todas las clasificaciones</option>
          {OPCIONES_CLASIFICACION.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="descontinuado">Descontinuado</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={datosFiltrados} alClickFila={(p) => navegar(`/central/inventario/catalogo/${p.id}`)} />
    </div>
  )
}
