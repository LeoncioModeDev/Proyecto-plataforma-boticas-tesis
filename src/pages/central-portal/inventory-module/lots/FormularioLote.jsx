import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoFecha from '@/components/forms/CampoFecha'
import CampoNumero from '@/components/forms/CampoNumero'
import { loteEsquema } from '@/schemas/loteEsquema'
import { productos } from '@/mock-data/productos'
import { OPCIONES_UBICACION } from '@/mock-data/boticas'

export default function FormularioLote() {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  const opcionesProducto = productos.filter(p => p.estado === 'activo').map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loteEsquema) })

  const alEnviar = (datos) => {
    console.log('[Mock] Lote creado:', datos)
    setExito(true)
    setTimeout(() => navegar('/central/inventario/lotes'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">Registrar Nuevo Lote</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El lote ha sido registrado correctamente." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
            <CampoSeleccion nombre="ubicacionId" etiqueta="Ubicación" opciones={OPCIONES_UBICACION} requerido register={register} error={errors.ubicacionId?.message} />
            <CampoTexto nombre="numeroLote" etiqueta="Número de Lote" requerido register={register} error={errors.numeroLote?.message} />
            <CampoFecha nombre="fechaVencimiento" etiqueta="Fecha de Vencimiento" requerido register={register} error={errors.fechaVencimiento?.message} />
            <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>Registrar lote</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
