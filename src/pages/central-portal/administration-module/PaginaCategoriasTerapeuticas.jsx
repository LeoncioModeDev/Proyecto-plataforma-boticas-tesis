import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Insignia from '@/components/common/Insignia'
import BarraFiltros from '@/components/common/BarraFiltros'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import SelectFiltro from '@/components/common/SelectFiltro'
import {
  listarCategoriasTerapeuticas,
} from '@/services/supabase/categoriasTerapeuticas'

export default function PaginaCategoriasTerapeuticas() {
  const navegar = useNavigate()
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError(null)
      const datos = await listarCategoriasTerapeuticas({
        q: busqueda,
        activo: filtroActivo,
      })
      setCategorias(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [busqueda, filtroActivo])

  useEffect(() => { cargar() }, [cargar])

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroActivo('')
  }

  const columnas = [
    { campo: 'codigo', encabezado: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
    { campo: 'nombre', encabezado: 'Nombre' },
    { campo: 'descripcion', encabezado: 'Descripción', render: (r) => r.descripcion || '—' },
    { campo: 'activo', encabezado: 'Estado', render: (r) => <Insignia color={r.activo ? 'verde' : 'gris'}>{r.activo ? 'Activa' : 'Inactiva'}</Insignia> },
    { campo: 'productosAsociados', encabezado: 'Productos asociados' },
  ]

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando categorías...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Categorías terapéuticas</h1>
          <p className="text-secundario mt-1">{categorias.length} categorías encontradas</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/administracion/categorias-terapeuticas/nueva')}>Nueva categoría</Boton>
      </div>

      {error && <Alerta tipo="error" titulo={error} onClose={() => setError(null)} />}
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar por código o nombre..." className="w-full sm:w-80" />
        <SelectFiltro valor={filtroActivo} alCambiar={setFiltroActivo} opciones={[{ valor: 'true', etiqueta: 'Activas' }, { valor: 'false', etiqueta: 'Inactivas' }]} placeholder="Todas las categorías" />
      </BarraFiltros>

      <Tabla columnas={columnas} datos={categorias} busqueda={false} alClickFila={(categoria) => navegar(`/central/administracion/categorias-terapeuticas/${categoria.id}`)} />
    </div>
  )
}
