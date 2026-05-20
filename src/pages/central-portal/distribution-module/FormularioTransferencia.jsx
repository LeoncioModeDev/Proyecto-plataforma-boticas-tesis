import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoTextoArea from '@/components/forms/CampoTextoArea'
import { transferenciaEsquema } from '@/schemas/transferenciaEsquema'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'

export default function FormularioTransferencia() {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  
  const opcionesDestino = boticas
    .filter(b => b.tipo === 'botica')
    .map(b => ({ valor: b.id, etiqueta: b.nombre }))

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    resolver: zodResolver(transferenciaEsquema),
    defaultValues: { items: [{ productoId: '', cantidad: 1 }] }
  })

  const itemsWatch = watch('items') || []
  const esValido = itemsWatch.some(i => i.productoId && i.cantidad > 0)

  const alEnviar = (datos) => {
    console.log('[Mock] Transferencia creada:', datos)
    setExito(true)
    setTimeout(() => navegar('/central/distribucion/transferencias'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">Nueva Transferencia</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardada exitosamente!" mensaje="La transferencia ha sido creada." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <CampoSeleccion 
            nombre="boticaId" 
            etiqueta="Botica Destino" 
            opciones={opcionesDestino} 
            requerido 
            register={register} 
            error={errors.boticaId?.message} 
          />
          
          <div className="border border-estilo rounded-tarjeta p-4">
            <p className="text-cuerpo font-medium text-principal mb-3">Productos a Transferir</p>
            <div className="space-y-3">
              {itemsWatch.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      {...register(`items.${index}.productoId`)}
                      className="w-full px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton"
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.filter(p => p.estado === 'activo').map(p => (
                        <option key={p.id} value={p.id}>{p.nombreComercial}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                      min="1"
                      placeholder="Cant."
                      className="w-full px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton text-center"
                    />
                  </div>
                </div>
              ))}
            </div>
            {errors.items?.message && (
              <p className="text-cuerpo text-estado-critico mt-2">{errors.items.message}</p>
            )}
          </div>

          <CampoTextoArea 
            nombre="observaciones" 
            etiqueta="Observaciones" 
            register={register} 
            placeholder="Notas adicionales sobre la transferencia..."
            filas={3}
          />
          
          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" icono={Save} disabled={!esValido} cargando={isSubmitting}>Crear Transferencia</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
