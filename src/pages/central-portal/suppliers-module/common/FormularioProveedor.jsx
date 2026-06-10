import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Plus, X } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import { proveedorEsquema } from '@/schemas/proveedorEsquema'
import { OPCIONES_IDENTIFICACION } from '@/mock-data/organizaciones'
import { proveedores as provMock } from '@/mock-data/proveedores'

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

function contactoVacio() {
  return { id: `c-${Date.now()}`, nombre: '', telefono: '', correo: '', direccion: '', ubigeo: '', principal: false }
}

export default function FormularioProveedor({ proveedorEditar, alGuardar }) {
  const navegar = useNavigate()
  const esEdicion = !!proveedorEditar

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(proveedorEsquema),
    defaultValues: proveedorEditar || { activo: true, tipoIdentificacion: 'ruc', paisOrigen: 'PE' },
  })

  const [contactos, setContactos] = useState([contactoVacio()])

  const actualizarContacto = (id, campo, valor) => {
    setContactos(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c))
  }

  const eliminarContacto = (id) => {
    setContactos(prev => prev.filter(c => c.id !== id))
  }

  const agregarContacto = () => {
    setContactos(prev => [...prev, contactoVacio()])
  }

  const alEnviar = (datos) => {
    const contactosValidos = contactos.filter(c => c.nombre.trim().length >= 3)

    const maxCodigo = provMock.reduce((max, p) => {
      const match = p.codigoInterno?.match(/PRV-(\d+)/)
      return match ? Math.max(max, parseInt(match[1])) : max
    }, 0)

    const proveedor = {
      id: proveedorEditar?.id || generarIdTemporal(),
      ...datos,
      codigoInterno: proveedorEditar?.codigoInterno || `PRV-${String(maxCodigo + 1).padStart(6, '0')}`,
      contactos: contactosValidos,
      condicionesComerciales: [],
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
          <div className="border-b border-neutro-gris-borde pb-4 mb-4">
            <h2 className="text-cuerpo font-semibold text-principal mb-4">Información del Proveedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {esEdicion && (
                <CampoTexto nombre="codigoInterno" etiqueta="Código Interno" register={register} readonly className="bg-gray-100 cursor-not-allowed" />
              )}
              <CampoTexto nombre="razonSocial" etiqueta="Razón Social" requerido register={register} error={errors.razonSocial?.message} />
              <CampoSeleccion nombre="tipoIdentificacion" etiqueta="Tipo de Identificación" opciones={OPCIONES_IDENTIFICACION} requerido register={register} error={errors.tipoIdentificacion?.message} />
              <CampoTexto nombre="numeroIdentificacion" etiqueta="Número de Identificación" requerido register={register} error={errors.numeroIdentificacion?.message} placeholder="Según tipo seleccionado" />
              <CampoSeleccion nombre="paisOrigen" etiqueta="País de Origen" opciones={OPCIONES_PAIS} requerido register={register} error={errors.paisOrigen?.message} />
            </div>
          </div>

          <div className="border-b border-neutro-gris-borde pb-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-cuerpo font-semibold text-principal">Contactos</h2>
              <Boton variante="texto" icono={Plus} onClick={agregarContacto} type="button" className="text-marca-principal text-sm">
                Agregar contacto
              </Boton>
            </div>
            {contactos.map((contacto) => (
              <div key={contacto.id} className="border border-estilo rounded-md p-4 mb-3 relative">
                {contactos.length > 1 && (
                  <button type="button" onClick={() => eliminarContacto(contacto.id)} className="absolute top-2 right-2 text-estado-critico hover:bg-rojo-claro rounded p-1">
                    <X className="size-4" />
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Nombre del Contacto *</label>
                    <input value={contacto.nombre} onChange={e => actualizarContacto(contacto.id, 'nombre', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Nombre completo" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Teléfono</label>
                    <input value={contacto.telefono} onChange={e => actualizarContacto(contacto.id, 'telefono', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Teléfono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Correo</label>
                    <input value={contacto.correo} onChange={e => actualizarContacto(contacto.id, 'correo', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="correo@ejemplo.com" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Ubigeo (opcional)</label>
                    <input value={contacto.ubigeo} onChange={e => actualizarContacto(contacto.id, 'ubigeo', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="6 dígitos" maxLength={6} />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-principal">Dirección</label>
                    <input value={contacto.direccion} onChange={e => actualizarContacto(contacto.id, 'direccion', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal" placeholder="Dirección completa" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={contacto.principal} onChange={e => actualizarContacto(contacto.id, 'principal', e.target.checked)} className="rounded border-estilo text-marca-principal" id={`principal-${contacto.id}`} />
                    <label htmlFor={`principal-${contacto.id}`} className="text-sm text-principal cursor-pointer">Contacto principal</label>
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
