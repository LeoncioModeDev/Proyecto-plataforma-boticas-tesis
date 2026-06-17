import { useState, useEffect, useMemo } from 'react'
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
import { ajusteEsquema, mapearSubtipo, esAjuste, SUBTIPOS_AJUSTE as OPCIONES_SUBTIPO } from '@/schemas/ajusteEsquema'
import { obtenerBoticasActivas } from '@/services/supabase/boticas'
import { obtenerLotesActivos } from '@/services/supabase/lotes'
import { registrarAjuste, registrarMerma } from '@/services/supabase/ajustes'
import { obtenerProductos } from '@/services/supabase/productos'
import useAutenticacion from '@/state/useAutenticacion'

export default function FormularioAjuste() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [exito, setExito] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [ubicaciones, setUbicaciones] = useState([])
  const [lotes, setLotes] = useState([])
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(true)
  const [cargandoLotes, setCargandoLotes] = useState(false)
  const [productos, setProductos] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(true)

  const opcionesProducto = useMemo(
    () => productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial })),
    [productos],
  )

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ajusteEsquema),
    defaultValues: { subtipo: '', productoId: '', ubicacionTipo: '', ubicacionId: '', loteId: '', cantidad: '', motivo: '' },
  })

  const productoId = watch('productoId')
  const ubicacionId = watch('ubicacionId')
  const subtipo = watch('subtipo')
  const loteId = watch('loteId')

  const loteSeleccionado = useMemo(
    () => lotes.find(l => l.id === loteId),
    [lotes, loteId],
  )

  useEffect(() => {
    if (!usuario?.orgId) return
    setCargandoUbicaciones(true)
    obtenerBoticasActivas(usuario.orgId)
      .then(data => {
        setUbicaciones(data)
        setCargandoUbicaciones(false)
      })
      .catch(err => {
        setErrorMsg(err.message)
        setCargandoUbicaciones(false)
      })
  }, [usuario?.orgId])

  useEffect(() => {
    setCargandoProductos(true)
    obtenerProductos({ activos: true })
      .then(data => {
        setProductos(data)
        setCargandoProductos(false)
      })
      .catch(err => {
        setErrorMsg(err.message)
        setCargandoProductos(false)
      })
  }, [])

  const opcionesUbicacion = useMemo(
    () => ubicaciones.map(u => ({ valor: u.id, etiqueta: `${u.nombre} (${u.tipo === 'drogueria' ? 'Droguería' : 'Botica'})` })),
    [ubicaciones],
  )

  useEffect(() => {
    if (!productoId || !ubicacionId) {
      setLotes([])
      return
    }

    const ubicacion = ubicaciones.find(u => u.id === ubicacionId)
    if (!ubicacion) return

    const ubicacionTipo = ubicacion.tipo
    const ubicacionIdVal = ubicacionTipo === 'drogueria' ? null : ubicacion.id

    setCargandoLotes(true)
    obtenerLotesActivos(productoId, ubicacionTipo, ubicacionIdVal)
      .then(data => {
        setLotes(data)
        setCargandoLotes(false)
      })
      .catch(() => {
        setLotes([])
        setCargandoLotes(false)
      })
  }, [productoId, ubicacionId, ubicaciones])

  useEffect(() => {
    if (!ubicacionId) return
    const ubicacion = ubicaciones.find(u => u.id === ubicacionId)
    if (ubicacion) {
      setValue('ubicacionTipo', ubicacion.tipo)
    }
  }, [ubicacionId, ubicaciones, setValue])

  const opcionesLote = useMemo(
    () => lotes.map(l => ({
      valor: l.id,
      etiqueta: `${l.numeroLote} | Vence: ${l.fechaVencimiento || 'N/A'} | Disp: ${l.cantidad}`,
    })),
    [lotes],
  )

  const opcionesSubtipo = useMemo(
    () => OPCIONES_SUBTIPO.map(s => ({ valor: s.valor, etiqueta: s.etiqueta })),
    [],
  )

  const alEnviar = async (datos) => {
    setErrorMsg(null)
    const mapeo = mapearSubtipo(datos.subtipo)
    if (!mapeo) {
      setErrorMsg('Tipo de ajuste inválido')
      return
    }

    const ubicacion = ubicaciones.find(u => u.id === datos.ubicacionId)
    if (!ubicacion) {
      setErrorMsg('Ubicación inválida')
      return
    }

    const payload = {
      productoId: datos.productoId,
      loteId: datos.loteId,
      ubicacionTipo: ubicacion.tipo,
      ubicacionId: ubicacion.tipo === 'drogueria' ? null : datos.ubicacionId,
      cantidad: datos.cantidad,
      motivo: datos.motivo,
      ...(mapeo.direccionAjuste ? { direccionAjuste: mapeo.direccionAjuste } : {}),
    }

    try {
      if (mapeo.tipoMovimiento === 'ajuste') {
        await registrarAjuste(payload)
      } else {
        await registrarMerma(payload)
      }
      setExito(true)
      setTimeout(() => navegar(-1), 1500)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-neutro-negro">Registrar Ajuste o Merma</h1>
      </div>

      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El ajuste ha sido registrado correctamente." />}
      {errorMsg && <Alerta tipo="error" titulo="Error" mensaje={errorMsg} />}

      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion
              nombre="subtipo"
              etiqueta="Tipo de Ajuste"
              opciones={opcionesSubtipo}
              requerido
              register={register}
              error={errors.subtipo?.message}
              placeholder="Seleccionar tipo..."
            />
            <CampoSeleccion
              nombre="productoId"
              etiqueta="Producto"
              opciones={opcionesProducto}
              requerido
              register={register}
              error={errors.productoId?.message}
              placeholder={cargandoProductos ? 'Cargando productos...' : 'Seleccionar producto...'}
            />
            <CampoSeleccion
              nombre="ubicacionId"
              etiqueta="Ubicación"
              opciones={opcionesUbicacion}
              requerido
              register={register}
              error={errors.ubicacionId?.message}
              placeholder={cargandoUbicaciones ? 'Cargando ubicaciones...' : 'Seleccionar ubicación...'}
            />
            <CampoSeleccion
              nombre="loteId"
              etiqueta="Lote"
              opciones={opcionesLote}
              requerido
              register={register}
              error={errors.loteId?.message}
              placeholder={
                !productoId || !ubicacionId
                  ? 'Primero seleccione producto y ubicación'
                  : cargandoLotes
                    ? 'Cargando lotes...'
                    : 'Seleccionar lote...'
              }
            />
            <CampoNumero
              nombre="cantidad"
              etiqueta="Cantidad"
              min={1}
              requerido
              register={register}
              error={errors.cantidad?.message}
            />
          </div>

          {loteSeleccionado && subtipo && (
            <div className="text-sm text-secundario bg-fondo p-3 rounded-md border border-estilo">
              <span className="font-medium">Stock disponible en lote:</span>{' '}
              <span className="font-bold text-principal">{loteSeleccionado.cantidad}</span>
            </div>
          )}

          <CampoTextoArea
            nombre="motivo"
            etiqueta="Motivo (detallado)"
            requerido
            register={register}
            error={errors.motivo?.message}
            filas={4}
            placeholder={esAjuste(subtipo || '')
              ? 'Ej: Conteo físico diferente al sistema — inventario mensual...'
              : 'Ej: Producto vencido detectado en revisión de almacén...'
            }
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-neutro-gris-borde">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting}>
              {esAjuste(subtipo || '') ? 'Registrar ajuste' : 'Registrar merma'}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
