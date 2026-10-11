import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { actualizarCategoriaTerapeutica, crearCategoriaTerapeutica, obtenerCategoriaTerapeutica } from '@/services/supabase/categoriasTerapeuticas'

export default function FormularioCategoriaTerapeutica() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editando = Boolean(id)
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '' })
  const [cargando, setCargando] = useState(editando)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!editando) return
    obtenerCategoriaTerapeutica(id)
      .then(categoria => setForm({ codigo: categoria.codigo, nombre: categoria.nombre, descripcion: categoria.descripcion || '' }))
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [editando, id])

  const guardar = async (e) => {
    e.preventDefault()
    try {
      setGuardando(true)
      setError(null)
      if (editando) {
        await actualizarCategoriaTerapeutica(id, form)
        navegar(`/central/administracion/categorias-terapeuticas/${id}`)
      } else {
        const resultado = await crearCategoriaTerapeutica({ ...form, activo: true })
        navegar(`/central/administracion/categorias-terapeuticas/${resultado.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="flex justify-center py-12"><p className="text-secundario">Cargando categoría...</p></div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(editando ? `/central/administracion/categorias-terapeuticas/${id}` : '/central/administracion/categorias-terapeuticas')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{editando ? 'Editar categoría terapéutica' : 'Crear categoría terapéutica'}</h1>
      </div>
      {error && <Alerta tipo="error" titulo="Error" mensaje={error} />}
      <Tarjeta>
        <form onSubmit={guardar} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-medium text-principal">Código <span className="text-estado-critico">*</span></label>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" required />
            </div>
            <div>
              <label className="text-sm font-medium text-principal">Nombre <span className="text-estado-critico">*</span></label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" required />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-principal">Descripción</label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md min-h-28" />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar(editando ? `/central/administracion/categorias-terapeuticas/${id}` : '/central/administracion/categorias-terapeuticas')}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={guardando}>{editando ? 'Guardar cambios' : 'Crear categoría'}</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
