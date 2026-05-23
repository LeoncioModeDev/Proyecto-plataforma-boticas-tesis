import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { productos as productosMock } from '@/mock-data/productos'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION, OPCIONES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [productos, setProductos] = useState(productosMock)
  const [filtroClasificacion, setFiltroClasificacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)

  const datosFiltrados = productos.filter(p => {
    const matchClasificacion = filtroClasificacion ? p.clasificacion === filtroClasificacion : true
    const matchEstado = filtroEstado ? p.estado === filtroEstado : true
    return matchClasificacion && matchEstado
  })

  const manejarToggleActivo = (id) => {
    const producto = productos.find(p => p.id === id)
    if (producto.estado === 'activo') {
      setConfirmarDesactivar(id)
    } else {
      setProductos(productos.map(p => p.id === id ? { ...p, estado: 'activo' } : p))
      setExito('Producto activado correctamente')
      setTimeout(() => setExito(null), 2000)
    }
  }

  const confirmarDesactivacion = () => {
    setProductos(productos.map(p => p.id === confirmarDesactivar ? { ...p, estado: 'inactivo' } : p))
    setExito('Producto desactivado correctamente')
    setConfirmarDesactivar(null)
    setTimeout(() => setExito(null), 2000)
  }

  const columnas = [
    { campo: 'nombreComercial', encabezado: 'Nombre Comercial' },
    { campo: 'principioActivo', encabezado: 'Principio Activo' },
    { campo: 'formaFarmaceutica', encabezado: 'Forma', render: (r) => <span className="capitalize">{r.formaFarmaceutica}</span> },
    { campo: 'concentracion', encabezado: 'Concentración' },
    { campo: 'laboratorio', encabezado: 'Laboratorio' },
    { campo: 'clasificacion', encabezado: 'Clasificación', render: (r) => <Insignia color={COLORES_CLASIFICACION[r.clasificacion]}>{ETIQUETAS_CLASIFICACION[r.clasificacion]}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO[r.estado]}>{ETIQUETAS_ESTADO[r.estado]}</Insignia> },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={() => navegar(`/central/inventario/catalogo/${r.id}/editar`)} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
          <Boton
            variante="icono"
            icono={r.estado === 'activo' ? ToggleRight : ToggleLeft}
            onClick={() => manejarToggleActivo(r.id)}
            title={r.estado === 'activo' ? 'Desactivar' : 'Activar'}
            className={r.estado === 'activo' ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Catálogo de Productos</h1>
          <p className="text-secundario mt-1">{datosFiltrados.length} productos encontrados</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/catalogo/nuevo')}>Agregar producto</Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <div className="flex gap-4">
        <select value={filtroClasificacion} onChange={e => setFiltroClasificacion(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas las clasificaciones</option>
          {OPCIONES_CLASIFICACION.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="descontinuado">Descontinuado</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={datosFiltrados} alClickFila={(p) => navegar(`/central/inventario/catalogo/${p.id}`)} />

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar Desactivación">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar este producto? El producto no se eliminará, pero quedará inactivo en el catálogo.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setConfirmarDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarDesactivacion}>Desactivar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
