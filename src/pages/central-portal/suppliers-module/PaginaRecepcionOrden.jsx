import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { obtenerOrden, obtenerPendientes, registrarRecepcion } from '@/services/supabase/ordenesCompra'

const RESULTADOS = [
  { valor: 'recibida', etiqueta: 'Recibida', desc: 'Todo conforme' },
  { valor: 'recibida_con_observacion', etiqueta: 'Recibida con observación', desc: 'Aceptada con notas' },
  { valor: 'recibida_parcial', etiqueta: 'Recibida parcial', desc: 'Solo algunos productos recibidos' },
  { valor: 'en_devolucion', etiqueta: 'En devolución', desc: 'Rechazada — no se acepta nada' },
]

export default function PaginaRecepcionOrden() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [orden, setOrden] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('recibida')
  const [observacion, setObservacion] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [items, setItems] = useState([])

  const cargarDatos = async () => {
    try {
      const [ordenData, pendientesData] = await Promise.all([
        obtenerOrden(id),
        obtenerPendientes(id),
      ])
      setOrden(ordenData)
      setPendientes(pendientesData)
      if (pendientesData.length === 0) {
        setResultado('en_devolucion')
      }
      setItems(pendientesData.map(p => ({
        productoId: p.producto_id,
        productoNombre: p.productoNombre,
        cantidadSolicitada: p.cantidad_solicitada,
        cantidadPendiente: p.cantidad_pendiente,
        numeroLote: '',
        fechaVencimiento: '',
        cantidadRecibida: p.cantidad_pendiente,
      })))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [id])

  const actualizarItem = (index, campo, valor) => {
    const nuevos = [...items]
    nuevos[index][campo] = campo === 'cantidadRecibida' ? Number(valor) : valor
    setItems(nuevos)
  }

  const alEnviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)

    try {
      if (resultado === 'en_devolucion') {
        if (!motivoRechazo.trim()) {
          setError('Debes ingresar el motivo de la devolución')
          setEnviando(false)
          return
        }
        const result = await registrarRecepcion(id, {
          resultado,
          motivoRechazo: motivoRechazo.trim(),
        })
        if (result.exito) {
          setExito(true)
          setTimeout(() => navegar(-1), 2000)
        }
        return
      }

      if (resultado === 'recibida_con_observacion' && !observacion.trim()) {
        setError('Debes ingresar una observación para esta recepción')
        setEnviando(false)
        return
      }

      const itemsValidos = items.filter(i => i.cantidadRecibida > 0)
      if (itemsValidos.length === 0) {
        setError('Debes registrar al menos un item con cantidad recibida')
        setEnviando(false)
        return
      }

      if (resultado === 'recibida_parcial') {
        for (const item of itemsValidos) {
          if (item.cantidadRecibida >= item.cantidadPendiente) {
            setError(`"${item.productoNombre}": en recepción parcial la cantidad recibida debe ser menor a ${item.cantidadPendiente}`)
            setEnviando(false)
            return
          }
        }
      }

      const result = await registrarRecepcion(id, {
        items: itemsValidos,
        resultado,
        observacion: observacion || undefined,
      })

      if (result.exito) {
        setExito(true)
        setTimeout(() => navegar(-1), 2000)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secundario">Cargando datos de la orden...</p>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Alerta tipo="exito" titulo="¡Recepción registrada exitosamente!" mensaje="La operación se ha completado." />
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Alerta tipo="error" titulo="Error" mensaje={error || 'No se pudo cargar la orden de compra'} />
        <Boton variante="secundario" onClick={() => navegar(-1)} icono={ArrowLeft}>Volver</Boton>
      </div>
    )
  }

  const esDevolucion = resultado === 'en_devolucion'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">Registrar Recepción</h1>
      </div>

      <Tarjeta>
        <div className="mb-4">
          <p className="text-sm text-secundario">Orden de Compra</p>
          <p className="text-lg font-medium text-principal">{orden.numeroOrden || orden.id?.slice(0, 8)} — {orden.proveedorNombre}</p>
          <p className="text-sm text-secundario mt-1">
            {pendientes.length} producto(s) pendiente(s) de recibir
          </p>
        </div>
      </Tarjeta>

      {error && <Alerta tipo="error" titulo="Error" mensaje={error} />}

      <Tarjeta>
        <form onSubmit={alEnviar} className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-principal">Resultado de la recepción</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESULTADOS.map(r => (
                <label
                  key={r.valor}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    resultado === r.valor
                      ? 'border-azul-500 bg-azul-50 dark:bg-azul-950'
                      : 'border-estilo hover:border-azul-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={r.valor}
                    checked={resultado === r.valor}
                    onChange={e => setResultado(e.target.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-principal">{r.etiqueta}</p>
                    <p className="text-xs text-secundario">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {esDevolucion ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Motivo de devolución *</label>
              <textarea
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                placeholder="Describa el motivo del rechazo (producto incorrecto, lote dañado, vencimiento inaceptable, etc.)"
                rows={3}
                required
                className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <p className="text-sm font-medium text-principal">Productos a recibir</p>
                {items.map((item, index) => (
                  <div key={item.productoId} className="border border-estilo rounded-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-principal">{item.productoNombre}</p>
                      <span className="text-xs text-secundario">
                        Pendiente: {item.cantidadPendiente} | Solicitado: {item.cantidadSolicitada}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-secundario">N° Lote *</label>
                        <input
                          type="text"
                          value={item.numeroLote}
                          onChange={e => actualizarItem(index, 'numeroLote', e.target.value)}
                          placeholder="Ej: LOTE001"
                          required
                          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-secundario">Fecha Venc. *</label>
                        <input
                          type="date"
                          value={item.fechaVencimiento}
                          onChange={e => actualizarItem(index, 'fechaVencimiento', e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          required
                          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                        />
                      </div>
                      {resultado === 'recibida_parcial' ? (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-secundario">Cant. recibida *</label>
                          <input
                            type="number"
                            value={item.cantidadRecibida}
                            onChange={e => actualizarItem(index, 'cantidadRecibida', e.target.value)}
                            min="1"
                            max={item.cantidadPendiente - 1}
                            required
                            className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md text-center"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-secundario">Cantidad a recibir</label>
                          <p className="px-3 py-2 text-cuerpo bg-fondo/50 border border-estilo rounded-md text-center text-principal font-medium">
                            {item.cantidadPendiente}
                          </p>
                        </div>
                      )}
                    </div>

                    {resultado === 'recibida_parcial' && item.cantidadRecibida >= item.cantidadPendiente && (
                      <p className="text-xs text-estado-critico">
                        En recepción parcial, la cantidad debe ser menor a {item.cantidadPendiente}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {(resultado === 'recibida_con_observacion') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-principal">Observaciones *</label>
                  <textarea
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                    placeholder="Detalle las observaciones de esta recepción (embalaje defectuoso, cajas golpeadas, etc.)"
                    rows={2}
                    required
                    className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" icono={Save} disabled={enviando}>
              {enviando ? 'Registrando...' : 'Registrar Recepción'}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
