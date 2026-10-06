import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Eraser } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoSeleccionMultiple from '@/components/forms/CampoSeleccionMultiple'
import Alerta from '@/components/common/Alerta'
import { productoEsquema } from '@/schemas/productoEsquema'
import { OPCIONES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { OPCIONES_ESTADO } from '@/constants/estadoProducto'
import { crearProducto, actualizarProducto, obtenerProductoPorId } from '@/services/supabase/productos'
import { obtenerOpcionesFormasFarmaceuticas, obtenerOpcionesPrincipiosActivos, obtenerOpcionesUnidadesMedida } from '@/services/supabase/catalogo'
import { listarCategoriasTerapeuticas } from '@/services/supabase/categoriasTerapeuticas'

export default function FormularioProducto({ productoEditar }) {
  const navegar = useNavigate()
  const { id } = useParams()
  const [cargando, setCargando] = useState(!!id && !productoEditar)
  const [error, setError] = useState(null)
  const [opcionesFormas, setOpcionesFormas] = useState([])
  const [opcionesCategorias, setOpcionesCategorias] = useState([])
  const [opcionesPrincipios, setOpcionesPrincipios] = useState([])
  const [opcionesUnidades, setOpcionesUnidades] = useState([])
  const esEdicion = !!(id || productoEditar)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productoEsquema),
    defaultValues: {
      nombreComercial: '',
      categoriaTerapeuticaId: '',
      formaFarmaceuticaId: '',
      presentacion: '',
      clasificacion: '',
      estado: 'activo',
      principiosActivos: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'principiosActivos',
  })

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [formas, principios, unidades, categorias] = await Promise.all([
          obtenerOpcionesFormasFarmaceuticas(),
          obtenerOpcionesPrincipiosActivos(),
          obtenerOpcionesUnidadesMedida(),
          listarCategoriasTerapeuticas({ activo: true }),
        ])
        setOpcionesFormas(formas)
        setOpcionesCategorias(categorias.map(c => ({ valor: c.id, etiqueta: `${c.codigo} — ${c.nombre}` })))
        setOpcionesPrincipios(principios)
        setOpcionesUnidades(unidades)
      } catch (err) {
        setError(err.message)
      }
    }
    cargarCatalogos()
  }, [])

  useEffect(() => {
    if (!id || productoEditar) return
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const datos = await obtenerProductoPorId(id)
        if (!datos) throw new Error('Producto no encontrado')

        setValue('nombreComercial', datos.nombreComercial)
        setValue('categoriaTerapeuticaId', datos.categoriaTerapeuticaId || '')
        setValue('formaFarmaceuticaId', datos.formaFarmaceuticaId || '')
        setValue('presentacion', datos.presentacion || '')
        setValue('clasificacion', datos.clasificacion)
        setValue('estado', datos.estado)

        if (datos.principiosActivos?.length > 0) {
          replace(datos.principiosActivos.map(pa => ({
            principioActivoId: pa.principioActivoId,
            concentracion: pa.concentracion,
            unidadMedidaId: pa.unidadMedidaId || '',
          })))
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id, productoEditar, setValue, replace])

  const alCambiarPrincipios = (ids) => {
    const currentIds = fields.map(f => f.principioActivoId)
    currentIds.forEach(id => {
      if (!ids.includes(id)) {
        const idx = fields.findIndex(f => f.principioActivoId === id)
        if (idx >= 0) remove(idx)
      }
    })
    ids.forEach(id => {
      if (!currentIds.includes(id)) {
        append({ principioActivoId: id, concentracion: '', unidadMedidaId: '' })
      }
    })
  }

  const alEnviar = async (datos) => {
    try {
      setError(null)
      const payload = {
        ...datos,
        principiosActivos: (datos.principiosActivos || []).map(pa => ({
          principioActivoId: pa.principioActivoId,
          concentracion: Number(pa.concentracion),
          unidadMedidaId: pa.unidadMedidaId || '',
        })),
      }

      if (esEdicion) {
        await actualizarProducto(id, payload)
        navegar(`/central/inventario/catalogo/${id}`)
      } else {
        const result = await crearProducto(payload)
        navegar(`/central/inventario/catalogo/${result.id}`)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const limpiar = () => {
    replace([])
    setValue('nombreComercial', '')
    setValue('categoriaTerapeuticaId', '')
    setValue('formaFarmaceuticaId', '')
    setValue('presentacion', '')
    setValue('clasificacion', '')
  }

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando producto...</p></div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(esEdicion ? `/central/inventario/catalogo/${id}` : '/central/inventario/catalogo')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{esEdicion ? 'Editar Producto' : 'Nuevo Producto'}</h1>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <CampoTexto nombre="nombreComercial" etiqueta="Nombre Comercial" requerido register={register} error={errors.nombreComercial?.message} placeholder="Ingrese el nombre comercial" />
          <CampoSeleccion nombre="categoriaTerapeuticaId" etiqueta="Categoría terapéutica" opciones={opcionesCategorias} requerido register={register} error={errors.categoriaTerapeuticaId?.message} placeholder="Seleccione la categoría" />

          <CampoSeleccionMultiple
            nombre="principiosActivos"
            etiqueta="Principios Activos"
            opciones={opcionesPrincipios}
            valoresSeleccionados={fields.map(f => f.principioActivoId)}
            alCambiar={alCambiarPrincipios}
            requerido
            error={errors.principiosActivos?.message}
          />

          {fields.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-principal">
                Concentraciones <span className="text-estado-critico">*</span>
              </label>
              {fields.map((field, index) => (
                <div key={field.id}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium min-w-[140px] truncate">
                      {opcionesPrincipios.find(o => o.valor === field.principioActivoId)?.etiqueta || 'Desconocido'}
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="Valor"
                      {...register(`principiosActivos.${index}.concentracion`, { valueAsNumber: true })}
                      className="flex-1 px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal"
                    />
                    <select
                      {...register(`principiosActivos.${index}.unidadMedidaId`)}
                      className="w-24 px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal"
                    >
                      <option value="">Unidad</option>
                      {opcionesUnidades.map(u => (
                        <option key={u.valor} value={u.valor}>{u.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 mt-1 ml-[148px]">
                    {errors.principiosActivos?.[index]?.concentracion && (
                      <p className="text-xs text-estado-critico">{errors.principiosActivos[index].concentracion.message}</p>
                    )}
                    {errors.principiosActivos?.[index]?.unidadMedidaId && (
                      <p className="text-xs text-estado-critico">{errors.principiosActivos[index].unidadMedidaId.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion nombre="formaFarmaceuticaId" etiqueta="Forma Farmacéutica" opciones={opcionesFormas} requerido register={register} error={errors.formaFarmaceuticaId?.message} placeholder="Seleccione la forma" />
            <CampoTexto nombre="presentacion" etiqueta="Presentación" register={register} error={errors.presentacion?.message} placeholder="Ej: Caja x 30 Tabletas, Frasco x 60 mL" />
            <CampoSeleccion nombre="clasificacion" etiqueta="Clasificación" opciones={OPCIONES_CLASIFICACION} requerido register={register} error={errors.clasificacion?.message} placeholder="Seleccione la clasificación" />
            <CampoSeleccion nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO} requerido register={register} error={errors.estado?.message} placeholder="Seleccione el estado" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-estilo">
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting} className="flex-1">
              Guardar Producto
            </Boton>
            <Boton variante="secundario" icono={Eraser} onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
