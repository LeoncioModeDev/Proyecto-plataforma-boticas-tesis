import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import Tabla from '@/components/common/Tabla'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import { buscarProductosVenta, registrarVenta } from '@/services/supabase/ventas'
import { formatearSoles } from '@/utilities/formatearMoneda'

const MOTIVOS = [
  { valor: 'stock_insuficiente', etiqueta: 'Stock insuficiente' },
  { valor: 'sin_stock', etiqueta: 'Sin stock' },
  { valor: 'otro', etiqueta: 'Otro' },
]

function crearClaveIdempotencia() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function PaginaRegistrarVenta() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [cantidadSolicitada, setCantidadSolicitada] = useState(1)
  const [motivoNoAtencion, setMotivoNoAtencion] = useState('stock_insuficiente')
  const [detalleMotivo, setDetalleMotivo] = useState('')
  const [items, setItems] = useState([])
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  const cantidad = Math.max(Number(cantidadSolicitada || 0), 0)
  const atendidaVista = productoSeleccionado ? Math.min(cantidad, productoSeleccionado.stockDisponible) : 0
  const demandaVista = Math.max(cantidad - atendidaVista, 0)
  const total = items.reduce((acc, item) => acc + item.importeTotal, 0)
  const subtotal = total / 1.18
  const igv = total - subtotal

  async function buscar() {
    if (!busqueda.trim()) return
    setCargandoBusqueda(true)
    setError(null)
    try {
      const datos = await buscarProductosVenta({ busqueda, limite: 10 })
      setProductos(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoBusqueda(false)
    }
  }

  function seleccionarProducto(producto) {
    setProductoSeleccionado(producto)
    setCantidadSolicitada(1)
    setMotivoNoAtencion(producto.stockDisponible > 0 ? 'stock_insuficiente' : 'sin_stock')
    setDetalleMotivo('')
  }

  function agregarItem() {
    setError(null)
    if (!productoSeleccionado) {
      setError('Selecciona un producto para agregarlo a la venta.')
      return
    }
    if (!productoSeleccionado.tienePrecioVigente || productoSeleccionado.precioUnitario == null) {
      setError('El producto seleccionado no tiene precio vigente.')
      return
    }
    if (cantidad <= 0) {
      setError('La cantidad solicitada debe ser mayor a 0.')
      return
    }
    if (demandaVista > 0 && motivoNoAtencion === 'otro' && detalleMotivo.trim().length < 5) {
      setError('Detalla el motivo cuando seleccionas Otro.')
      return
    }

    const existente = items.find(item => item.productoId === productoSeleccionado.id)
    if (existente) {
      setError('Este producto ya está en el carrito. Retíralo y vuelve a agregarlo si necesitas cambiar la cantidad.')
      return
    }

    setItems(prev => [...prev, {
      productoId: productoSeleccionado.id,
      codigoProducto: productoSeleccionado.codigoProducto,
      producto: productoSeleccionado.producto,
      presentacion: productoSeleccionado.presentacion,
      cantidadSolicitada: cantidad,
      cantidadAtendida: atendidaVista,
      demandaNoAtendida: demandaVista,
      precioUnitario: productoSeleccionado.precioUnitario,
      importeTotal: atendidaVista * productoSeleccionado.precioUnitario,
      motivoNoAtencion: demandaVista > 0 ? motivoNoAtencion : null,
      detalleMotivo: demandaVista > 0 && motivoNoAtencion === 'otro' ? detalleMotivo.trim() : null,
    }])
    setProductoSeleccionado(null)
    setBusqueda('')
    setProductos([])
    setCantidadSolicitada(1)
  }

  async function confirmarVenta(e) {
    e.preventDefault()
    if (items.length === 0) {
      setError('Agrega al menos un producto a la venta.')
      return
    }
    setGuardando(true)
    setError(null)
    setExito(null)
    try {
      const venta = await registrarVenta({ items, claveIdempotencia: crearClaveIdempotencia() })
      setExito(`Venta ${venta.numeroVenta} registrada correctamente.`)
      setItems([])
      setTimeout(() => navigate('/botica/ventas'), 900)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const columnasCarrito = [
    { campo: 'producto', encabezado: 'Producto', render: r => <div><p className="font-medium">{r.producto}</p><p className="text-xs text-secundario font-mono">{r.codigoProducto}</p></div> },
    { campo: 'cantidadSolicitada', encabezado: 'Solicitada' },
    { campo: 'cantidadAtendida', encabezado: 'Atendida' },
    { campo: 'demandaNoAtendida', encabezado: 'No atendida' },
    { campo: 'precioUnitario', encabezado: 'Precio', render: r => formatearSoles(r.precioUnitario) },
    { campo: 'importeTotal', encabezado: 'Importe', render: r => formatearSoles(r.importeTotal) },
    { campo: 'acciones', encabezado: '', render: r => <button type="button" onClick={() => setItems(prev => prev.filter(item => item.productoId !== r.productoId))} className="text-estado-critico hover:underline"><Trash2 className="h-4 w-4" /></button> },
  ]

  return (
    <form onSubmit={confirmarVenta} className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-h1 text-principal">Registrar venta</h1>
        <p className="text-secundario mt-1">Busca productos, registra la cantidad solicitada y el sistema calculará stock, precio, atención y lotes FEFO.</p>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}
      {exito && <Alerta tipo="exito" titulo="Venta registrada" mensaje={exito} />}

      <Tarjeta titulo="Buscar producto" descripcion="El precio y el stock disponible se calculan automáticamente para tu botica.">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Código interno o nombre comercial" />
          <Boton onClick={buscar} cargando={cargandoBusqueda}>Buscar</Boton>
        </div>

        {productos.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {productos.map(producto => (
              <button key={producto.id} type="button" onClick={() => seleccionarProducto(producto)} className="text-left border border-estilo rounded-lg p-3 bg-fondo hover:border-marca-principal transition-colors">
                <p className="font-semibold text-principal">{producto.producto}</p>
                <p className="text-xs text-secundario font-mono">{producto.codigoProducto}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-secundario">
                  <span>Stock disponible: <strong className="text-principal">{producto.stockDisponible}</strong></span>
                  <span>Precio: <strong className="text-principal">{producto.precioUnitario == null ? 'Sin precio' : formatearSoles(producto.precioUnitario)}</strong></span>
                </div>
              </button>
            ))}
          </div>
        )}

        {productoSeleccionado && (
          <div className="mt-5 border-t border-estilo pt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <CampoLectura etiqueta="Producto" valor={productoSeleccionado.producto} />
              <CampoLectura etiqueta="Stock disponible" valor={productoSeleccionado.stockDisponible} />
              <CampoLectura etiqueta="Precio unitario" valor={productoSeleccionado.precioUnitario == null ? 'Sin precio vigente' : formatearSoles(productoSeleccionado.precioUnitario)} />
              <label className="text-sm font-medium text-principal">
                Cantidad solicitada
                <input type="number" min="1" value={cantidadSolicitada} onChange={e => setCantidadSolicitada(e.target.value)} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CampoLectura etiqueta="Solicitada" valor={cantidad || 0} />
              <CampoLectura etiqueta="Atendida estimada" valor={atendidaVista} />
              <CampoLectura etiqueta="Demanda no atendida estimada" valor={demandaVista} />
            </div>
            {demandaVista > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-principal">
                  Motivo
                  <select value={motivoNoAtencion} onChange={e => setMotivoNoAtencion(e.target.value)} className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md">
                    {MOTIVOS.map(motivo => <option key={motivo.valor} value={motivo.valor}>{motivo.etiqueta}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-principal">
                  Detalle
                  <input value={detalleMotivo} onChange={e => setDetalleMotivo(e.target.value)} placeholder="Obligatorio si el motivo es Otro" className="w-full mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md" />
                </label>
              </div>
            )}
            <p className="text-sm text-secundario">Los lotes serán asignados automáticamente mediante FEFO al confirmar.</p>
            <Boton type="button" onClick={agregarItem} icono={Plus}>Agregar al carrito</Boton>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Carrito de venta">
        <Tabla columnas={columnasCarrito} datos={items} busqueda={false} paginacion={false} mensajeVacio="Agrega productos para registrar la venta." />
        <div className="mt-5 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <FilaTotal etiqueta="Subtotal" valor={formatearSoles(subtotal)} />
            <FilaTotal etiqueta="IGV" valor={formatearSoles(igv)} />
            <FilaTotal etiqueta="Total" valor={formatearSoles(total)} fuerte />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-estilo">
          <Boton variante="secundario" onClick={() => navigate('/botica/ventas')}>Cancelar</Boton>
          <Boton tipo="submit" cargando={guardando} deshabilitado={items.length === 0}>Registrar venta</Boton>
        </div>
      </Tarjeta>
    </form>
  )
}

function CampoLectura({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-xs font-medium text-secundario">{etiqueta}</p>
      <p className="mt-1 px-3 py-2 bg-fondo border border-estilo rounded-md text-principal min-h-10">{valor || '-'}</p>
    </div>
  )
}

function FilaTotal({ etiqueta, valor, fuerte = false }) {
  return (
    <div className={`flex justify-between ${fuerte ? 'text-base font-semibold text-principal' : 'text-secundario'}`}>
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  )
}
