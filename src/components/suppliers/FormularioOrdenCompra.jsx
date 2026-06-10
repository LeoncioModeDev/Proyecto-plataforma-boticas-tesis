import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { proveedores } from '@/mock-data/proveedores'
import { productos } from '@/mock-data/productos'
import { proveedorProducto } from '@/mock-data/proveedor-producto'
import { generarIdOC, calcularTotal } from '@/mock-data/ordenesCompra'

export default function FormularioOrdenCompra({ onGuardar, redirectPath }) {
  const navegar = useNavigate()
  const [exito, setExito] = useState(false)
  const [proveedorId, setProveedorId] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState([{ productoId: '', cantidad: 1, precioUnitario: 0 }])

  const proveedoresActivos = proveedores.filter(p => p.activo)
  const productosActivos = productos.filter(p => p.estado === 'activo')

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
      const relacion = proveedorProducto.find(
        r => r.proveedorId === proveedorId && r.productoId === valor
      )
      nuevos[index].precioUnitario = relacion?.precioReferencial || 0
    }
    setItems(nuevos)
  }

  const esValido = proveedorId && items.some(i => i.productoId && i.cantidad > 0 && i.precioUnitario > 0)

  const alEnviar = (e) => {
    e.preventDefault()
    const nuevaOC = {
      id: generarIdOC(),
      proveedorId,
      proveedorNombre: proveedoresActivos.find(p => p.id === proveedorId)?.razonSocial || proveedorId,
      estado: 'pendiente',
      creadoPor: 'usr-002',
      creadoPorNombre: 'Ana Torres',
      fechaEstimadaEntrega: fechaEntrega || null,
      observaciones,
      aprobadoPor: null,
      fechaAprobacion: null,
      items: items.filter(i => i.productoId && i.cantidad > 0).map(i => {
        const prod = productosActivos.find(p => p.id === i.productoId)
        return {
          productoId: i.productoId,
          productoNombre: prod?.nombreComercial || i.productoId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        }
      }),
      createdAt: new Date().toISOString(),
    }
    onGuardar(nuevaOC)
    setExito(true)
    setTimeout(() => navegar(redirectPath), 1500)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">Nueva Orden de Compra</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Orden creada exitosamente!" mensaje="La orden de compra ha sido registrada y está pendiente de aprobación." />}
      <Tarjeta>
        <form onSubmit={alEnviar} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Proveedor *</label>
            <select
              value={proveedorId}
              onChange={e => setProveedorId(e.target.value)}
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              required
            >
              <option value="">Seleccionar proveedor</option>
              {proveedoresActivos.map(p => (
                <option key={p.id} value={p.id}>{p.razonSocial} ({p.numeroIdentificacion})</option>
              ))}
            </select>
          </div>

          <div className="border border-estilo rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-principal">Productos</p>
              <Boton variante="texto" icono={Plus} onClick={agregarItem} tamaňo="sm">Agregar producto</Boton>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      value={item.productoId}
                      onChange={e => actualizarItem(index, 'productoId', e.target.value)}
                      className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
                    >
                      <option value="">Seleccionar producto</option>
                      {productosActivos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombreComercial}</option>
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
              ))}
            </div>
          </div>

          <div className="text-right text-sm font-medium text-principal">
            Total estimado: <span className="text-marca-principal text-lg">S/ {calcularTotal(items).toFixed(2)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Fecha estimada de entrega</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
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
            <Boton type="submit" variante="primario" icono={Save} disabled={!esValido}>Crear Orden de Compra</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
