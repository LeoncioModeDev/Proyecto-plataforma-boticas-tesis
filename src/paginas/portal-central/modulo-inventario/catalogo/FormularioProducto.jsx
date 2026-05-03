import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tarjeta from '@/componentes/comunes/Tarjeta'
import CampoTexto from '@/componentes/formularios/CampoTexto'
import CampoSeleccion from '@/componentes/formularios/CampoSeleccion'
import { productoEsquema } from '@/esquemas/productoEsquema'
import { OPCIONES_CLASIFICACION } from '@/constantes/clasificacionProducto'
import { productos } from '@/datos-prueba/productos'
import Alerta from '@/componentes/comunes/Alerta'
import { useState } from 'react'

const OPCIONES_FORMA = [
  { valor: 'tableta', etiqueta: 'Tableta' }, { valor: 'capsula', etiqueta: 'Cápsula' },
  { valor: 'jarabe', etiqueta: 'Jarabe' }, { valor: 'crema', etiqueta: 'Crema' },
  { valor: 'suspension', etiqueta: 'Suspensión' }, { valor: 'inyectable', etiqueta: 'Inyectable' },
]

/**
 * Formulario para crear o editar un producto farmacéutico.
 */
export default function FormularioProducto({ productoEditar }) {
  const navegar = useNavigate()
  const { id } = useParams()
  const [exito, setExito] = useState(false)

  const productoExistente = productoEditar || (id ? productos.find(p => p.id === id) : null)
  const esEdicion = !!productoExistente

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productoEsquema),
    defaultValues: productoExistente || { estado: 'activo' },
  })

  const alEnviar = (datos) => {
    console.log(esEdicion ? '[Mock] Producto actualizado:' : '[Mock] Producto creado:', datos)
    setExito(true)
    setTimeout(() => navegar('/central/inventario/catalogo'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">{esEdicion ? 'Editar Producto' : 'Nuevo Producto'}</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El producto ha sido registrado correctamente." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoTexto nombre="nombreComercial" etiqueta="Nombre Comercial" requerido register={register} error={errors.nombreComercial?.message} />
            <CampoTexto nombre="principioActivo" etiqueta="Principio Activo" requerido register={register} error={errors.principioActivo?.message} />
            <CampoSeleccion nombre="formaFarmaceutica" etiqueta="Forma Farmacéutica" opciones={OPCIONES_FORMA} requerido register={register} error={errors.formaFarmaceutica?.message} />
            <CampoTexto nombre="concentracion" etiqueta="Concentración" requerido register={register} error={errors.concentracion?.message} />
            <CampoTexto nombre="laboratorio" etiqueta="Laboratorio" requerido register={register} error={errors.laboratorio?.message} />
            <CampoTexto nombre="codigoBarras" etiqueta="Código de Barras" register={register} error={errors.codigoBarras?.message} />
            <CampoSeleccion nombre="clasificacion" etiqueta="Clasificación" opciones={OPCIONES_CLASIFICACION} requerido register={register} error={errors.clasificacion?.message} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>Guardar producto</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
