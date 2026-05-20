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
import { ajusteEsquema } from '@/schemas/ajusteEsquema'
import { productos } from '@/mock-data/productos'

const OPCIONES_TIPO_AJUSTE = [
  { valor: 'ajuste_positivo', etiqueta: 'Ajuste Positivo' },
  { valor: 'ajuste_negativo', etiqueta: 'Ajuste Negativo' },
  { valor: 'merma_vencimiento', etiqueta: 'Merma por Vencimiento' },
  { valor: 'merma_dano', etiqueta: 'Merma por Daño' },
  { valor: 'merma_perdida', etiqueta: 'Merma por Pérdida' },
]

export default function FormularioAjuste() {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  const opcionesProducto = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(ajusteEsquema) })

  const alEnviar = (datos) => {
    console.log('[Mock] Ajuste registrado:', datos)
    setExito(true)
    setTimeout(() => navegar('/central/inventario/ajustes'), 1500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">Registrar Ajuste o Merma</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El ajuste ha sido registrado correctamente." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion nombre="tipo" etiqueta="Tipo de Ajuste" opciones={OPCIONES_TIPO_AJUSTE} requerido register={register} error={errors.tipo?.message} />
            <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
            <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
          </div>
          <CampoTextoArea nombre="motivo" etiqueta="Motivo (detallado)" requerido register={register} error={errors.motivo?.message} filas={4} placeholder="Describa en detalle el motivo del ajuste o merma..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>Registrar ajuste</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
