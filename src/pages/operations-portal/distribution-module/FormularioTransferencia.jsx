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
import { transferencias } from '@/mock-data/transferencias'
import useAutenticacion from '@/state/useAutenticacion'

let itemCounter = 100

export default function FormularioTransferencia() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [exito, setExito] = useState(false)

  const opcionesDestino = boticas
    .filter(b => b.tipo === 'botica')
    .map(b => ({ valor: b.id, etiqueta: b.nombre }))

  const opcionesProductos = productos
    .filter(p => p.estado === 'activo')
    .map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    resolver: zodResolver(transferenciaEsquema),
    defaultValues: { destinoId: '', items: [{ productoId: '', cantidad: 1 }], observaciones: '' }
  })

  const itemsWatch = watch('items') || []
  const esValido = itemsWatch.some(i => i.productoId && i.cantidad > 0)

  const alEnviar = (datos) => {
    const transferenciaId = `trans-${String(transferencias.length + 1).padStart(3, '0')}`
    const nuevaTransferencia = {
      id: transferenciaId,
      tipoTransferencia: 'transferencia_central',
      origenTipo: 'drogueria',
      origenId: 'ub-001',
      destinoTipo: 'botica',
      destinoId: datos.destinoId,
      estado: 'creada',
      creadoPor: usuario?.id || 'usr-001',
      fechaDespacho: null,
      fechaRecepcion: null,
      createdAt: new Date().toISOString(),
      items: datos.items
        .filter(i => i.productoId && i.cantidad > 0)
        .map((item, idx) => ({
          id: `ti-${itemCounter + idx}`,
          transferenciaId,
          productoId: item.productoId,
          loteId: null,
          cantidad: item.cantidad,
        })),
    }
    itemCounter += datos.items.length
    transferencias.push(nuevaTransferencia)
    setExito(true)
    setTimeout(() => navegar('/operaciones/distribucion/transferencias'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">Nueva Transferencia</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardada exitosamente!" mensaje="La transferencia ha sido creada y aparecerá en la tabla." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <input type="hidden" {...register('origenTipo')} value="drogueria" />
          <input type="hidden" {...register('origenId')} value="ub-001" />

          <div className="flex flex-col gap-1.5">
            <label className="text-etiqueta font-medium text-principal">Origen</label>
            <div className="px-3 py-2 text-cuerpo bg-fondo-secundario border border-estilo rounded-md text-principal select-none">
              Droguería Central
            </div>
          </div>

          <CampoSeleccion
            nombre="destinoId"
            etiqueta="Botica Destino"
            opciones={opcionesDestino}
            requerido
            register={register}
            error={errors.destinoId?.message}
          />

          <div className="border border-estilo rounded-tarjeta p-4">
            <p className="text-cuerpo font-medium text-principal mb-3">Productos a Transferir</p>
            <div className="space-y-3">
              {itemsWatch.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      {...register(`items.${index}.productoId`)}
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                    >
                      <option value="">Seleccionar producto</option>
                      {opcionesProductos.map(p => (
                        <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                      min="1"
                      placeholder="Cant."
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md text-center"
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

          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" icono={Save} disabled={!esValido} cargando={isSubmitting}>Crear Transferencia</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
