import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoNumero from '@/components/forms/CampoNumero'
import CampoTextoArea from '@/components/forms/CampoTextoArea'
import { movimientoEsquema } from '@/schemas/movimientoEsquema'
import { productos } from '@/mock-data/productos'
import { OPCIONES_UBICACION } from '@/mock-data/boticas'
import { OPCIONES_MOVIMIENTO } from '@/constants/tiposMovimiento'

export default function FormularioMovimiento() {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  const opcionesProducto = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(movimientoEsquema) })

  const alEnviar = (datos) => {
    console.log('[Mock] Movimiento registrado:', datos)
    setExito(true)
    setTimeout(() => navegar('/central/inventario/movimientos'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">Registrar Nuevo Movimiento</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El movimiento ha sido registrado correctamente." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion nombre="tipo" etiqueta="Tipo" opciones={OPCIONES_MOVIMIENTO} requerido register={register} error={errors.tipo?.message} />
            <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
            <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
            <CampoSeleccion nombre="ubicacionId" etiqueta="Ubicación" opciones={OPCIONES_UBICACION} requerido register={register} error={errors.ubicacionId?.message} />
          </div>
          <CampoTextoArea nombre="motivo" etiqueta="Motivo" requerido register={register} error={errors.motivo?.message} placeholder="Describa el motivo del movimiento..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>Registrar movimiento</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
