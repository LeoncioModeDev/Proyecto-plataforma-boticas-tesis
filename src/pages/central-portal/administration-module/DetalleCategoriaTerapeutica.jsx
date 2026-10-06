import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import ModalConfirmar from '@/components/common/ModalConfirmar'
import { cambiarEstadoCategoriaTerapeutica, obtenerCategoriaTerapeutica } from '@/services/supabase/categoriasTerapeuticas'

export default function DetalleCategoriaTerapeutica() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [categoria, setCategoria] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [confirmar, setConfirmar] = useState(false)

  const cargar = () => {
    setCargando(true)
    obtenerCategoriaTerapeutica(id)
      .then(setCategoria)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [id])

  const cambiarEstado = async () => {
    try {
      await cambiarEstadoCategoriaTerapeutica(id, { confirmar: true })
      setConfirmar(false)
      cargar()
    } catch (err) {
      setError(err.message)
      setConfirmar(false)
    }
  }

  if (cargando) return <div className="flex justify-center py-12"><p className="text-secundario">Cargando categoría...</p></div>
  if (error || !categoria) return <SinDatos titulo="Categoría no encontrada" descripcion={error || 'La categoría solicitada no existe.'} textoAccion="Volver" alAccionar={() => navegar('/central/administracion/categorias-terapeuticas')} />

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/administracion/categorias-terapeuticas')}>Volver</Boton>
        <div>
          <h1 className="text-h1 text-principal">{categoria.nombre}</h1>
          <p className="text-secundario mt-1">{categoria.codigo}</p>
        </div>
        <Insignia color={categoria.activo ? 'verde' : 'gris'}>{categoria.activo ? 'Activa' : 'Inactiva'}</Insignia>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" icono={categoria.activo ? ToggleLeft : ToggleRight} onClick={() => setConfirmar(true)}>{categoria.activo ? 'Desactivar' : 'Activar'}</Boton>
          <Boton variante="primario" icono={Edit} onClick={() => navegar(`/central/administracion/categorias-terapeuticas/${id}/editar`)}>Editar</Boton>
        </div>
      </div>

      <Tarjeta titulo="Información de la categoría">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
          <div><p className="text-etiqueta text-secundario">Código</p><p className="font-medium text-principal">{categoria.codigo}</p></div>
          <div><p className="text-etiqueta text-secundario">Productos asociados</p><p className="font-medium text-principal">{categoria.productosAsociados}</p></div>
          <div className="sm:col-span-2"><p className="text-etiqueta text-secundario">Descripción</p><p className="font-medium text-principal">{categoria.descripcion || 'Sin descripción'}</p></div>
        </div>
      </Tarjeta>

      <ModalConfirmar
        abierto={confirmar}
        alCerrar={() => setConfirmar(false)}
        alConfirmar={cambiarEstado}
        titulo={categoria.activo ? 'Desactivar categoría' : 'Activar categoría'}
        mensaje={`¿Deseas ${categoria.activo ? 'desactivar' : 'activar'} esta categoría terapéutica?`}
        etiquetaBoton={categoria.activo ? 'Desactivar' : 'Activar'}
      />
    </div>
  )
}
