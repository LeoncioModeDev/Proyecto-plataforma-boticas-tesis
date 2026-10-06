import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Edit, Truck } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { obtenerProductoPorId } from '@/services/supabase/productos'
import { listarProveedores } from '@/services/supabase/proveedores'
import { listarPorProducto, guardarRelacion, eliminarRelacion } from '@/services/supabase/proveedorProducto'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

export default function DetalleProducto() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [producto, setProducto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [modalProveedores, setModalProveedores] = useState(null)
  const [proveedoresProducto, setProveedoresProducto] = useState([])
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([])
  const [nuevoProvProd, setNuevoProvProd] = useState({ proveedorId: '', leadTimeEspecifico: '', precioCompraReferencial: '', cantidadMinimaCompra: '1', multiploEmpaque: '1' })
  const [exito, setExito] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const datos = await obtenerProductoPorId(id)
        if (!datos) throw new Error('Producto no encontrado')
        setProducto(datos)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  const abrirConfigurarProveedores = async () => {
    try {
      const existentes = await listarPorProducto(producto.id)
      setProveedoresProducto(existentes)

      const provs = await listarProveedores({ activos: true })
      setProveedoresDisponibles(provs)

      setModalProveedores(producto)
    } catch (err) {
      setError(err.message)
    }
  }

  const agregarProveedorProducto = async () => {
    if (!nuevoProvProd.proveedorId || !nuevoProvProd.leadTimeEspecifico || !nuevoProvProd.precioCompraReferencial) return
    if (Number(nuevoProvProd.leadTimeEspecifico) < 1) { setError('El lead time debe ser mayor a 0 días'); return }
    if (Number(nuevoProvProd.precioCompraReferencial) <= 0) { setError('El precio de compra debe ser mayor a 0'); return }
    if (Number(nuevoProvProd.cantidadMinimaCompra) < 1) { setError('La cantidad mínima debe ser mayor a 0'); return }
    if (Number(nuevoProvProd.multiploEmpaque) < 1) { setError('El múltiplo de empaque debe ser mayor a 0'); return }
    try {
      await guardarRelacion({
        proveedorId: nuevoProvProd.proveedorId,
        productoId: producto.id,
        leadTimeEspecifico: Number(nuevoProvProd.leadTimeEspecifico),
        precioCompraReferencial: Number(nuevoProvProd.precioCompraReferencial),
        cantidadMinimaCompra: Number(nuevoProvProd.cantidadMinimaCompra),
        multiploEmpaque: Number(nuevoProvProd.multiploEmpaque),
      })
      const actualizados = await listarPorProducto(producto.id)
      setProveedoresProducto(actualizados)
      setNuevoProvProd({ proveedorId: '', leadTimeEspecifico: '', precioCompraReferencial: '', cantidadMinimaCompra: '1', multiploEmpaque: '1' })
    } catch (err) {
      setError(err.message)
    }
  }

  const eliminarProveedorProducto = async (id) => {
    try {
      await eliminarRelacion(id)
      setProveedoresProducto(proveedoresProducto.filter(r => r.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const guardarConfigProveedores = () => {
    setExito('Proveedores configurados correctamente')
    setModalProveedores(null)
    setTimeout(() => setExito(null), 2000)
  }

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando producto...</p></div>
  }

  if (error || !producto) {
    return <SinDatos titulo="Producto no encontrado" descripcion={error || 'El producto solicitado no existe.'} textoAccion="Volver al catálogo" alAccionar={() => navegar('/central/inventario/catalogo')} />
  }

  const infoPrincipios = (producto.principiosActivos || []).map(pa => ({
    nombre: pa.principioActivoNombre || 'Desconocido',
    concentracion: pa.concentracion,
    unidad: pa.unidadMedidaSimbolo || '',
  }))

  const formaDisplay = producto.formaFarmaceuticaNombre
    ? producto.formaFarmaceuticaNombre.charAt(0).toUpperCase() + producto.formaFarmaceuticaNombre.slice(1)
    : producto.formaFarmaceuticaId || '—'

  return (
    <div className="space-y-6 max-w-4xl">
      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}
      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/inventario/catalogo')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{producto.nombreComercial}</h1>
        <Insignia color={COLORES_ESTADO[producto.estado]}>{ETIQUETAS_ESTADO[producto.estado]}</Insignia>
        <div className="ml-auto flex gap-2">
          <Boton variante="secundario" icono={Truck} onClick={abrirConfigurarProveedores}>Configurar Lead Times</Boton>
          <Boton variante="primario" icono={Edit} onClick={() => navegar(`/central/inventario/catalogo/${producto.id}/editar`)}>Editar</Boton>
        </div>
      </div>
      <Tarjeta titulo="Información del Producto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
          {[
            ['Principios Activos', infoPrincipios.length > 0 ? infoPrincipios.map((p, i) => (
              <div key={i} className="mb-1">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-secundario ml-1">({p.concentracion} {p.unidad})</span>
              </div>
            )) : '—'],
            ['Categoría terapéutica', producto.categoriaTerapeuticaNombre || 'Sin categoría'],
            ['Forma Farmacéutica', formaDisplay],
            ['Presentación', producto.presentacion || '—'],
            ['Clasificación', <Insignia key="c" color={COLORES_CLASIFICACION[producto.clasificacion]}>{ETIQUETAS_CLASIFICACION[producto.clasificacion]}</Insignia>],
          ].map(([label, val], i) => (
            <div key={i} className={i === 1 ? 'md:col-span-2' : ''}>
              <p className="text-etiqueta text-secundario">{label}</p>
              <div className="text-cuerpo text-principal mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Modal abierto={!!modalProveedores} alCerrar={() => setModalProveedores(null)} titulo={`Configurar Lead Times — ${producto.nombreComercial}`}>
        <div className="space-y-4">
          {proveedoresProducto.filter(r => r.activo !== false).length === 0 ? (
            <p className="text-secundario">Sin proveedores asociados</p>
          ) : (
            <div className="divide-y divide-estilo max-h-60 overflow-y-auto">
              {proveedoresProducto.filter(r => r.activo !== false).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{r.proveedorNombre || r.proveedorId}</p>
                    <p className="text-xs text-secundario">Lead time: {r.leadTimeEspecifico} días | S/ {r.precioCompraReferencial}</p>
                    <p className="text-xs text-secundario">Compra mínima: {r.cantidadMinimaCompra} unidades | Múltiplo de empaque: {r.multiploEmpaque} unidades</p>
                  </div>
                  <Boton variante="texto" onClick={() => eliminarProveedorProducto(r.id)} className="text-estado-critico text-sm">Eliminar</Boton>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-estilo pt-4 space-y-3">
            <p className="text-sm font-medium">Agregar proveedor</p>
            <select
              value={nuevoProvProd.proveedorId}
              onChange={e => setNuevoProvProd({ ...nuevoProvProd, proveedorId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedoresDisponibles.map(p => (
                <option key={p.id} value={p.id}>{p.razonSocial}</option>
              ))}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secundario">Lead time (días)</label>
                <input type="number" min="1" value={nuevoProvProd.leadTimeEspecifico} onChange={e => setNuevoProvProd({ ...nuevoProvProd, leadTimeEspecifico: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
              <div>
                <label className="text-xs text-secundario">Precio compra (S/)</label>
                <input type="number" min="0.01" step="0.01" value={nuevoProvProd.precioCompraReferencial} onChange={e => setNuevoProvProd({ ...nuevoProvProd, precioCompraReferencial: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secundario">Cantidad mínima de compra</label>
                <input type="number" min="1" value={nuevoProvProd.cantidadMinimaCompra} onChange={e => setNuevoProvProd({ ...nuevoProvProd, cantidadMinimaCompra: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
              <div>
                <label className="text-xs text-secundario">Múltiplo de empaque</label>
                <input type="number" min="1" value={nuevoProvProd.multiploEmpaque} onChange={e => setNuevoProvProd({ ...nuevoProvProd, multiploEmpaque: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
            </div>
            <Boton variante="secundario" onClick={agregarProveedorProducto} className="w-full">Agregar</Boton>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModalProveedores(null)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarConfigProveedores}>Guardar configuración</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
