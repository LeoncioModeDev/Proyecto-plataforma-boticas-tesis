import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import Insignia from '@/components/common/Insignia'
import {
  listarCategoriasTerapeuticas,
  crearCategoriaTerapeutica,
  actualizarCategoriaTerapeutica,
  cambiarEstadoCategoriaTerapeutica,
} from '@/services/supabase/categoriasTerapeuticas'

const FORM_INICIAL = { codigo: '', nombre: '', descripcion: '', activo: true }

export default function PaginaCategoriasTerapeuticas() {
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

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

  const abrirCrear = () => {
    setForm(FORM_INICIAL)
    setModal({ modo: 'crear' })
  }

  const abrirEditar = (categoria) => {
    setForm({
      codigo: categoria.codigo,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      activo: categoria.activo,
    })
    setModal({ modo: 'editar', categoria })
  }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      setGuardando(true)
      setError(null)
      if (modal?.modo === 'editar') {
        await actualizarCategoriaTerapeutica(modal.categoria.id, form)
        setExito('Categoría actualizada')
      } else {
        await crearCategoriaTerapeutica(form)
        setExito('Categoría creada')
      }
      setModal(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async (categoria, confirmar = false) => {
    try {
      setError(null)
      await cambiarEstadoCategoriaTerapeutica(categoria.id, { confirmar })
      setExito(categoria.activo ? 'Categoría desactivada' : 'Categoría activada')
      await cargar()
    } catch (err) {
      if (err.detalle?.requiere_confirmacion) {
        const ok = window.confirm(`${err.message}\n\nProductos activos asociados: ${err.detalle.productos_activos}. ¿Desea desactivarla de todos modos?`)
        if (ok) return cambiarEstado(categoria, true)
      }
      setError(err.message)
    }
  }

  const columnas = [
    { campo: 'codigo', encabezado: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
    { campo: 'nombre', encabezado: 'Nombre' },
    { campo: 'descripcion', encabezado: 'Descripción', render: (r) => r.descripcion || '—' },
    { campo: 'activo', encabezado: 'Estado', render: (r) => <Insignia color={r.activo ? 'verde' : 'gris'}>{r.activo ? 'Activa' : 'Inactiva'}</Insignia> },
    { campo: 'productosAsociados', encabezado: 'Productos asociados' },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton
            variante="icono"
            icono={Pencil}
            onClick={() => abrirEditar(r)}
            title="Editar categoría"
            className="text-marca-principal hover:bg-marca-claro"
          />
          <Boton
            variante="icono"
            icono={r.activo ? ToggleLeft : ToggleRight}
            onClick={() => cambiarEstado(r)}
            title={r.activo ? 'Desactivar categoría' : 'Activar categoría'}
            className="text-marca-principal hover:bg-marca-claro"
          />
        </div>
      ),
    },
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
        <Boton variante="primario" icono={Plus} onClick={abrirCrear}>Nueva categoría</Boton>
      </div>

      {error && <Alerta tipo="error" titulo={error} onClose={() => setError(null)} />}
      {exito && <Alerta tipo="exito" titulo={exito} onClose={() => setExito(null)} />}

      <div className="flex gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-secundario absolute left-3 top-3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="w-full pl-9 pr-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
          />
        </div>
        <select value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas las categorías</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </div>

      <Tabla columnas={columnas} datos={categorias} />

      <Modal abierto={!!modal} alCerrar={() => setModal(null)} titulo={modal?.modo === 'editar' ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-principal">Código <span className="text-estado-critico">*</span></label>
            <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" placeholder="CAT-ANA" required />
          </div>
          <div>
            <label className="text-sm font-medium text-principal">Nombre <span className="text-estado-critico">*</span></label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" placeholder="Analgésicos" required />
          </div>
          <div>
            <label className="text-sm font-medium text-principal">Descripción</label>
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md min-h-24" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModal(null)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" cargando={guardando}>Guardar</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
