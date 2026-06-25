import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { listarPorProveedor } from '@/services/supabase/proveedorProducto'
import { supabase } from '@/services/supabase/cliente'
import useAutenticacion from '@/state/useAutenticacion'

export default function FormularioOrdenCompra({ onGuardar, redirectPath, ordenExistente }) {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [exito, setExito] = useState(false)
  const [proveedorId, setProveedorId] = useState(ordenExistente?.proveedorId || '')
  const [fechaEstimadaEntrega, setFechaEstimadaEntrega] = useState(ordenExistente?.fechaEstimadaEntrega || '')
  const [observaciones, setObservaciones] = useState(ordenExistente?.observaciones || '')
  const [items, setItems] = useState(
    ordenExistente?.items?.map(i => ({
      productoId: i.productoId,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
    })) || [{ productoId: '', cantidad: 1, precioUnitario: 0 }]
  )
  const [proveedores, setProveedores] = useState([])
  const [productosProveedor, setProductosProveedor] = useState([])
  const [cargando, setCargando] = useState(true)

  const relacionProducto = (productoId) => productosProveedor.find(r => r.productoId === productoId)

  const calcularCantidadSugerida = (cantidad, relacion) => {
    const minimo = Number(relacion?.cantidadMinimaCompra || 1)
    const multiplo = Number(relacion?.multiploEmpaque || 1)
    const ajustada = Math.max(Number(cantidad || 0), minimo)
    return Math.ceil(ajustada / multiplo) * multiplo
  }

  const validarItem = (item) => {
    if (!item.productoId) return null
    const relacion = relacionProducto(item.productoId)
    if (!relacion) return null
    const sugerida = calcularCantidadSugerida(item.cantidad, relacion)
    if (Number(item.cantidad) === sugerida) return null
    return {
      compraMinima: relacion.cantidadMinimaCompra || 1,
      multiploEmpaque: relacion.multiploEmpaque || 1,
      cantidadSugerida: sugerida,
    }
  }

  const cargarProveedores = useCallback(async () => {
    try {
      const query = supabase
        .from('proveedores')
        .select('id, razon_social, numero_identificacion, activo')
        .eq('activo', true)

      if (usuario?.orgId) query.eq('org_id', usuario.orgId)

      const { data, error } = await query.order('razon_social')

      if (error) throw error
      setProveedores(data || [])
    } catch (e) {
      console.error('Error cargando proveedores:', e)
    } finally {
      setCargando(false)
    }
  }, [usuario])

  const cargarProductosProveedor = useCallback(async (provId) => {
    try {
      const data = await listarPorProveedor(provId, true)
      setProductosProveedor(data)
    } catch (e) {
      console.error('Error cargando productos del proveedor:', e)
      setProductosProveedor([])
    }
  }, [])

  useEffect(() => { Promise.resolve().then(cargarProveedores) }, [cargarProveedores])
  useEffect(() => {
    if (proveedorId) Promise.resolve().then(() => cargarProductosProveedor(proveedorId))
    else Promise.resolve().then(() => setProductosProveedor([]))
  }, [proveedorId, cargarProductosProveedor])

  const agregarItem = () => {
    setItems([...items, { productoId: '', cantidad: 1, precioUnitario: 0 }])
  }

  const eliminarItem = (index) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const actualizarItem = (index, campo, valor) => {
    const nuevos = [...items]
    nuevos[index][campo] = campo === 'cantidad' || campo === 'precioUnitario' ? Number(valor) : valor
    if (campo === 'productoId') {
      const relacion = productosProveedor.find(r => r.productoId === valor)
      nuevos[index].precioUnitario = relacion?.precioCompraReferencial || 0
      nuevos[index].leadTimeEspecifico = relacion?.leadTimeEspecifico || null
      nuevos[index].cantidadMinimaCompra = relacion?.cantidadMinimaCompra || 1
      nuevos[index].multiploEmpaque = relacion?.multiploEmpaque || 1
    }
    setItems(nuevos)
  }

  const erroresCantidad = items.map(validarItem)
  const hayCantidadesInvalidas = erroresCantidad.some(Boolean)
  const esValido = proveedorId && fechaEstimadaEntrega && items.some(i => i.productoId && i.cantidad > 0) && !hayCantidadesInvalidas

  const aplicarCantidadSugerida = (index, cantidad) => {
    const nuevos = [...items]
    nuevos[index].cantidad = cantidad
    setItems(nuevos)
  }

  const alEnviar = async (e) => {
    e.preventDefault()
    if (hayCantidadesInvalidas) return
    const itemsValidos = items.filter(i => i.productoId && i.cantidad > 0)
    const orden = {
      proveedorId,
      fechaEstimadaEntrega,
      observaciones,
      items: itemsValidos.map(i => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      })),
    }
    await onGuardar(orden)
    setExito(true)
    setTimeout(() => navegar(redirectPath), 1500)
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secundario">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">
          {ordenExistente ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
        </h1>
      </div>

      {exito && (
        <Alerta tipo="exito" titulo="¡Orden creada exitosamente!" mensaje="La orden de compra ha sido registrada y está pendiente de aprobación." />
      )}

      <Tarjeta>
        <form onSubmit={alEnviar} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Proveedor *</label>
            <select
              value={proveedorId}
              onChange={e => {
                setProveedorId(e.target.value)
                setItems([{ productoId: '', cantidad: 1, precioUnitario: 0 }])
              }}
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              required
              disabled={!!ordenExistente}
            >
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.razon_social} ({p.numero_identificacion})</option>
              ))}
            </select>
          </div>

          <div className="border border-estilo rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-principal">Productos</p>
              <Boton variante="texto" icono={Plus} onClick={agregarItem} tamaňo="sm">Agregar producto</Boton>
            </div>

            {!proveedorId && (
              <p className="text-sm text-secundario py-4 text-center">Selecciona un proveedor para ver sus productos</p>
            )}

            {proveedorId && productosProveedor.length === 0 && (
              <p className="text-sm text-secundario py-4 text-center">Este proveedor no tiene productos asignados</p>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const relacion = relacionProducto(item.productoId)
                const errorCantidad = erroresCantidad[index]
                return (
                <div key={index} className="space-y-2">
                  <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      value={item.productoId}
                      onChange={e => actualizarItem(index, 'productoId', e.target.value)}
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                    >
                      <option value="">Seleccionar producto</option>
                      {productosProveedor.map(r => (
                        <option key={r.productoId} value={r.productoId}>
                          {r.productoNombre} {r.presentacion ? `(${r.presentacion})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={e => actualizarItem(index, 'cantidad', e.target.value)}
                      min="1"
                      placeholder="Cant."
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md text-center"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={e => actualizarItem(index, 'precioUnitario', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="P. Unit."
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md text-right"
                    />
                  </div>
                  <div className="w-24 pt-2 text-right text-sm text-secundario">
                    {(item.cantidad * item.precioUnitario).toFixed(2)}
                  </div>
                  <Boton variante="icono" icono={Trash2} onClick={() => eliminarItem(index)} className="text-estado-critico hover:bg-rojo-claro mt-1" title="Eliminar" />
                </div>
                  {relacion && (
                    <p className="text-xs text-secundario ml-1">
                      Compra mínima: {relacion.cantidadMinimaCompra || 1} unidades · Múltiplo de empaque: {relacion.multiploEmpaque || 1} unidades · Lead time: {relacion.leadTimeEspecifico} días
                    </p>
                  )}
                  {errorCantidad && (
                    <Alerta
                      tipo="advertencia"
                      titulo="La cantidad ingresada no cumple las condiciones del proveedor."
                      mensaje={`Compra mínima: ${errorCantidad.compraMinima}. Múltiplo de empaque: ${errorCantidad.multiploEmpaque}. Cantidad válida sugerida: ${errorCantidad.cantidadSugerida}.`}
                    />
                  )}
                  {errorCantidad && (
                    <Boton variante="secundario" tamano="pequeno" onClick={() => aplicarCantidadSugerida(index, errorCantidad.cantidadSugerida)}>
                      Aplicar cantidad sugerida
                    </Boton>
                  )}
                </div>
              )})}
            </div>
          </div>

          <div className="text-right text-sm font-medium text-principal">
            Total estimado:{' '}
            <span className="text-marca-principal text-lg">
              S/ {items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0).toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Fecha estimada de entrega *</label>
            <input
              type="date"
              value={fechaEstimadaEntrega}
              onChange={e => setFechaEstimadaEntrega(e.target.value)}
              required
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md w-56"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales sobre la orden..."
              rows={3}
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" icono={Save} disabled={!esValido}>
              {ordenExistente ? 'Guardar Cambios' : 'Crear Orden de Compra'}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
