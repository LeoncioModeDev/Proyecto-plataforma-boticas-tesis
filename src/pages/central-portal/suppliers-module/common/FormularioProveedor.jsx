import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Plus, X } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoSeleccionUbigeo from '@/components/forms/CampoSeleccionUbigeo'
import { proveedorEsquema } from '@/schemas/proveedorEsquema'
import { obtenerOpcionesPaises, obtenerOpcionesUbigeos, obtenerOpcionesMonedas } from '@/services/supabase/catalogo'

const OPCIONES_IDENTIFICACION = [
  { valor: 'ruc', etiqueta: 'RUC' },
  { valor: 'dni', etiqueta: 'DNI' },
  { valor: 'carnet-extranjeria', etiqueta: 'Carnet de Extranjería' },
  { valor: 'pasaporte', etiqueta: 'Pasaporte' },
]

export default function FormularioProveedor({ proveedorEditar, alGuardar }) {
  const navegar = useNavigate()
  const esEdicion = !!proveedorEditar
  const [opcionesPaises, setOpcionesPaises] = useState([])
  const [opcionesUbigeo, setOpcionesUbigeo] = useState([])
  const [opcionesMonedas, setOpcionesMonedas] = useState([])

  useEffect(() => {
    Promise.all([obtenerOpcionesPaises(), obtenerOpcionesUbigeos(), obtenerOpcionesMonedas()])
      .then(([paises, ubigeos, monedas]) => {
        setOpcionesPaises(paises)
        setOpcionesUbigeo(ubigeos)
        setOpcionesMonedas(monedas)
      })
      .catch(console.error)
  }, [])

  const defaultContacto = { nombre: '', telefono: '', correo: '', direccion: '', ubigeo: '', principal: false }

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(proveedorEsquema),
    defaultValues: proveedorEditar || {
      activo: true,
      tipoIdentificacion: 'ruc',
      paisOrigen: 'PE',
      monedaId: null,
      contactos: [defaultContacto],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contactos',
  })

  const alEnviar = (datos) => {
    alGuardar(datos)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/proveedores')}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">{esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h1>
      </div>
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="border-b border-neutro-gris-borde pb-4 mb-4">
            <h2 className="text-cuerpo font-semibold text-principal mb-4">Información del Proveedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <CampoTexto nombre="razonSocial" etiqueta="Razón Social" requerido register={register} error={errors.razonSocial?.message} />
              <CampoSeleccion nombre="tipoIdentificacion" etiqueta="Tipo de Identificación" opciones={OPCIONES_IDENTIFICACION} requerido register={register} error={errors.tipoIdentificacion?.message} />
              <CampoTexto nombre="numeroIdentificacion" etiqueta="Número de Identificación" requerido register={register} error={errors.numeroIdentificacion?.message} placeholder="Según tipo seleccionado" />
              <CampoSeleccion nombre="paisOrigen" etiqueta="País de Origen" opciones={opcionesPaises} requerido register={register} error={errors.paisOrigen?.message} />
              <CampoSeleccion nombre="monedaId" etiqueta="Moneda" opciones={opcionesMonedas} register={register} error={errors.monedaId?.message} placeholder="Seleccionar moneda..." />
            </div>
          </div>

          <div className="border-b border-neutro-gris-borde pb-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-cuerpo font-semibold text-principal">Contactos</h2>
              <Boton variante="texto" icono={Plus} onClick={() => append(defaultContacto)} type="button" className="text-marca-principal text-sm">
                Agregar contacto
              </Boton>
            </div>
            {errors.contactos && !Array.isArray(errors.contactos) && (
              <p className="text-sm text-estado-critico mb-2">{errors.contactos.message}</p>
            )}
            {errors.contactos?.root && (
              <p className="text-sm text-estado-critico mb-2">{errors.contactos.root.message}</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="border border-estilo rounded-md p-4 mb-3 relative">
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 text-estado-critico hover:bg-rojo-claro rounded p-1">
                    <X className="size-4" />
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Nombre del Contacto *</label>
                    <input {...register(`contactos.${index}.nombre`)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Nombre completo" />
                    {errors.contactos?.[index]?.nombre && (
                      <p className="text-xs text-estado-critico">{errors.contactos[index].nombre.message}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Teléfono</label>
                    <input {...register(`contactos.${index}.telefono`)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Teléfono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Correo</label>
                    <input {...register(`contactos.${index}.correo`)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="correo@ejemplo.com" />
                  </div>
                  <CampoSeleccionUbigeo
                    etiqueta="Ubigeo"
                    opciones={opcionesUbigeo}
                    valor={watch(`contactos.${index}.ubigeo`)}
                    alCambiar={(v) => setValue(`contactos.${index}.ubigeo`, v)}
                    error={errors.contactos?.[index]?.ubigeo?.message}
                  />
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Dirección</label>
                    <input {...register(`contactos.${index}.direccion`)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Dirección completa" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" {...register(`contactos.${index}.principal`)} className="rounded border-estilo text-marca-principal" id={`principal-${index}`} />
                    <label htmlFor={`principal-${index}`} className="text-sm text-principal cursor-pointer">Contacto principal</label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
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
