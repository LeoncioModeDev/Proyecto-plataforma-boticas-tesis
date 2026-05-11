import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoNumero from '@/components/forms/CampoNumero'
import { proveedorEsquema } from '@/schemas/proveedorEsquema'
import { OPCIONES_IDENTIFICACION } from '@/mock-data/organizaciones'

const OPCIONES_CONDICIONES_PAGO = [
  { valor: 'Contado', etiqueta: 'Contado' },
  { valor: 'Crédito 15 días', etiqueta: 'Crédito 15 días' },
  { valor: 'Crédito 30 días', etiqueta: 'Crédito 30 días' },
  { valor: 'Crédito 45 días', etiqueta: 'Crédito 45 días' },
  { valor: 'Crédito 60 días', etiqueta: 'Crédito 60 días' },
  { valor: 'Carta de crédito 60 días', etiqueta: 'Carta de crédito 60 días' },
  { valor: 'Carta de crédito 90 días', etiqueta: 'Carta de crédito 90 días' },
]

const OPCIONES_PAIS = [
  { valor: 'PE', etiqueta: 'Perú' },
  { valor: 'US', etiqueta: 'Estados Unidos' },
  { valor: 'DE', etiqueta: 'Alemania' },
  { valor: 'ES', etiqueta: 'España' },
  { valor: 'MX', etiqueta: 'México' },
  { valor: 'CO', etiqueta: 'Colombia' },
  { valor: 'CL', etiqueta: 'Chile' },
  { valor: 'AR', etiqueta: 'Argentina' },
  { valor: 'BR', etiqueta: 'Brasil' },
  { valor: 'JP', etiqueta: 'Japón' },
  { valor: 'CN', etiqueta: 'China' },
  { valor: 'IN', etiqueta: 'India' },
]

let idTemporal = 1000

function generarIdTemporal() {
  return `prov-${++idTemporal}`
}

export default function FormularioProveedor({ proveedorEditar, alGuardar }) {
  const navegar = useNavigate()
  const esEdicion = !!proveedorEditar

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(proveedorEsquema),
    defaultValues: proveedorEditar || { activo: true, tipoIdentificacion: 'ruc', paisOrigen: 'PE' },
  })

  const alEnviar = (datos) => {
    const proveedor = {
      id: proveedorEditar?.id || generarIdTemporal(),
      ...datos,
      createdAt: proveedorEditar?.createdAt || new Date().toISOString(),
    }
    alGuardar(proveedor)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/proveedores')}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">{esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h1>
      </div>
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="border-b border-estilo pb-4 mb-4">
            <h2 className="text-cuerpo font-semibold text-principal mb-4">Información del Proveedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CampoTexto nombre="razonSocial" etiqueta="Razón Social" requerido register={register} error={errors.razonSocial?.message} />
              <CampoSeleccion nombre="tipoIdentificacion" etiqueta="Tipo de Identificación" opciones={OPCIONES_IDENTIFICACION} requerido register={register} error={errors.tipoIdentificacion?.message} />
              <CampoTexto nombre="numeroIdentificacion" etiqueta="Número de Identificación" requerido register={register} error={errors.numeroIdentificacion?.message} placeholder="Según tipo seleccionado" />
              <CampoSeleccion nombre="paisOrigen" etiqueta="País de Origen" opciones={OPCIONES_PAIS} requerido register={register} error={errors.paisOrigen?.message} />
            </div>
          </div>
          <div className="border-b border-estilo pb-4 mb-4">
            <h2 className="text-cuerpo font-semibold text-principal mb-4">Datos de Contacto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CampoTexto nombre="contacto" etiqueta="Nombre del Contacto" requerido register={register} error={errors.contacto?.message} />
              <CampoTexto nombre="telefono" etiqueta="Teléfono" requerido register={register} error={errors.telefono?.message} />
              <CampoTexto nombre="correo" etiqueta="Correo" tipo="email" requerido register={register} error={errors.correo?.message} />
              <CampoTexto nombre="direccion" etiqueta="Dirección" requerido register={register} error={errors.direccion?.message} className="md:col-span-2" />
              <CampoTexto nombre="ubigeo" etiqueta="Ubigeo (opcional)" register={register} error={errors.ubigeo?.message} placeholder="6 dígitos" />
              <CampoTexto nombre="distrito" etiqueta="Distrito" requerido register={register} error={errors.distrito?.message} />
            </div>
          </div>
          <div>
            <h2 className="text-cuerpo font-semibold text-principal mb-4">Condiciones Comerciales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CampoNumero nombre="leadTimeDias" etiqueta="Lead Time (días)" requerido register={register} error={errors.leadTimeDias?.message} />
              <CampoSeleccion nombre="condicionesPago" etiqueta="Condiciones de Pago" opciones={OPCIONES_CONDICIONES_PAGO} requerido register={register} error={errors.condicionesPago?.message} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar('/central/proveedores')}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>
              {esEdicion ? 'Actualizar' : 'Crear'} Proveedor
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}