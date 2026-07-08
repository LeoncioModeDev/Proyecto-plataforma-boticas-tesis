import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoTextoArea from '@/components/forms/CampoTextoArea'
import { transferenciaEsquema } from '@/schemas/transferenciaEsquema'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { crearTransferencia } from '@/services/supabase/transferencias'

let itemIdCounter = 0

export default function FormularioTransferencia() {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [boticasDestino, setBoticasDestino] = useState([])
  const [productos, setProductos] = useState([])
  const [drogueria, setDrogueria] = useState(null)
  const [lotesPorProducto, setLotesPorProducto] = useState({})
  const [cargandoLotes, setCargandoLotes] = useState({})

  const { register, handleSubmit, formState: { errors, isSubmitting }, control, setValue, getValues } = useForm({
    resolver: zodResolver(transferenciaEsquema),
    defaultValues: {
      destinoId: '',
      items: [{ _key: ++itemIdCounter, productoId: '', loteId: '', cantidad: 1 }],
      observaciones: '',
    },
  })

  const itemsWatch = useWatch({ control, name: 'items' })

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [boticas, productosData, droguerias] = await Promise.all([
          listarBoticas({ tipo: 'botica', activas: true }),
          obtenerProductos({ activos: true }),
          listarBoticas({ tipo: 'drogueria' }),
        ])
        setBoticasDestino(boticas)
        setProductos(productosData)
        setDrogueria(droguerias[0] || null)
      } catch (e) {
        setError('Error al cargar datos iniciales: ' + e.message)
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [])

  useEffect(() => {
    itemsWatch.forEach((item) => {
      if (item.productoId && !lotesPorProducto[item.productoId] && !cargandoLotes[item.productoId] && drogueria) {
        setCargandoLotes(prev => ({ ...prev, [item.productoId]: true }))
        obtenerLotesActivos(item.productoId, 'drogueria', drogueria.id)
          .then(lotes => {
            setLotesPorProducto(prev => ({ ...prev, [item.productoId]: lotes }))
          })
          .catch(() => {
            setLotesPorProducto(prev => ({ ...prev, [item.productoId]: [] }))
          })
          .finally(() => {
            setCargandoLotes(prev => ({ ...prev, [item.productoId]: false }))
          })
      }
    })
  }, [itemsWatch, lotesPorProducto, cargandoLotes, drogueria])

  const agregarItem = () => {
    const items = getValues('items') || []
    setValue('items', [...items, { _key: ++itemIdCounter, productoId: '', loteId: '', cantidad: 1 }], { shouldValidate: false })
  }

  const quitarItem = (index) => {
    const items = getValues('items') || []
    if (items.length <= 1) return
    setValue('items', items.filter((_, i) => i !== index), { shouldValidate: true })
  }

  const alEnviar = async (datos) => {
    setError(null)

    for (const item of datos.items) {
      if (!item.productoId || !item.loteId || !item.cantidad) continue
      const lotes = lotesPorProducto[item.productoId] || []
      const lote = lotes.find(l => l.id === item.loteId)
      if (lote && item.cantidad > lote.cantidad) {
        setError(`La cantidad del lote ${lote.numeroLote} (${item.cantidad}) supera el disponible (${lote.cantidad} uds)`)
        return
      }
    }

    try {
      const payload = {
        destino_id: datos.destinoId,
        observaciones: datos.observaciones || null,
        items: datos.items
          .filter(i => i.productoId && i.loteId && i.cantidad > 0)
          .map(i => ({
            producto_id: i.productoId,
            lote_id: i.loteId,
            cantidad: i.cantidad,
          })),
      }
      await crearTransferencia(payload)
      setExito(true)
      setTimeout(() => navegar('/operaciones/distribucion/transferencias'), 1500)
    } catch (e) {
      setError(e.message)
    }
  }

  if (cargando) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
          <h1 className="text-h1 text-principal">Cargando...</h1>
        </div>
      </div>
    )
  }

  const esValido = itemsWatch.some(i => i.productoId && i.loteId && i.cantidad > 0)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">Nueva Transferencia</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardada exitosamente!" mensaje="La transferencia ha sido creada." />}
      {error && <Alerta tipo="error" titulo="Error" mensaje={error} />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-etiqueta font-medium text-principal">Origen</label>
            <div className="px-3 py-2 text-cuerpo bg-fondo-secundario border border-estilo rounded-md text-principal select-none">
              {drogueria?.nombre || 'Droguería Central'}
            </div>
          </div>

          <CampoSeleccion
            nombre="destinoId"
            etiqueta="Botica Destino"
            opciones={boticasDestino.map(b => ({ valor: b.id, etiqueta: b.nombre }))}
            requerido
            register={register}
            error={errors.destinoId?.message}
          />

          <div className="border border-estilo rounded-tarjeta p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-cuerpo font-medium text-principal">Productos a Transferir</p>
              <Boton variante="texto" tamano="pequeno" icono={Plus} onClick={agregarItem}>Agregar Producto</Boton>
            </div>
            <div className="space-y-3">
              {itemsWatch.map((item, index) => {
                const lotesDisponibles = lotesPorProducto[item.productoId] || []
                return (
                  <div key={item._key} className="flex flex-col gap-2 p-3 bg-fondo rounded-md border border-estilo">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <select
                          {...register(`items.${index}.productoId`)}
                          onChange={(e) => {
                            setValue(`items.${index}.productoId`, e.target.value, { shouldValidate: true })
                            setValue(`items.${index}.loteId`, '', { shouldValidate: true })
                          }}
                          className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                        >
                          <option value="">Seleccionar producto</option>
                          {productos.map(p => (
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
                          className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md text-center"
                        />
                      </div>
                      <Boton
                        variante="icono"
                        icono={Trash2}
                        className="text-estado-critico hover:bg-rojo-claro mt-1"
                        onClick={() => quitarItem(index)}
                        disabled={itemsWatch.length <= 1}
                        title="Quitar producto"
                      />
                    </div>
                    <div>
                      <select
                        {...register(`items.${index}.loteId`)}
                        disabled={!item.productoId}
                        className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                      >
                        <option value="">
                          {!item.productoId
                            ? 'Primero seleccione un producto'
                            : cargandoLotes[item.productoId]
                              ? 'Cargando lotes...'
                              : lotesDisponibles.length === 0
                                ? 'Sin lotes disponibles'
                                : 'Seleccionar lote'}
                        </option>
                        {lotesDisponibles.map(l => (
                          <option key={l.id} value={l.id}>
                            Lote {l.numeroLote} — Vence: {l.fechaVencimiento} — Disp: {l.cantidad} uds
                          </option>
                        ))}
                      </select>
                      {errors.items?.[index]?.loteId && (
                        <p className="text-xs text-estado-critico mt-1">{errors.items[index].loteId.message}</p>
                      )}
                    </div>
                  </div>
                )
              })}
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

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" icono={Save} disabled={!esValido} cargando={isSubmitting}>Crear Transferencia</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
