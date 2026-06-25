import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarProveedores } from '@/services/supabase/proveedores'
import { listarPorProducto, guardarRelacion, eliminarRelacion } from '@/services/supabase/proveedorProducto'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION, OPCIONES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

function enriquecerProductos(productos) {
  return productos.map(p => ({
    ...p,
    principioActivoDisplay: (p.principiosActivos || []).map(pa => pa.principioActivoNombre).join(', '),
    concentracionDisplay: (p.principiosActivos || []).map(pa => `${pa.concentracion} ${pa.unidadMedidaSimbolo || ''}`).join(', '),
    formaDisplay: p.formaFarmaceuticaNombre || p.formaFarmaceuticaId || '—',
    presentacionDisplay: p.presentacion || '—',
  }))
}

export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroClasificacion, setFiltroClasificacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [exito, setExito] = useState(null)
  const [modalProveedores, setModalProveedores] = useState(null)
  const [proveedoresProducto, setProveedoresProducto] = useState([])
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([])
  const [nuevoProvProd, setNuevoProvProd] = useState({ proveedorId: '', leadTimeEspecifico: '', precioCompraReferencial: '', cantidadMinimaCompra: '1', multiploEmpaque: '1' })

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true)
      setError(null)
      const datos = await obtenerProductos()
      setProductos(enriquecerProductos(datos))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const datosFiltrados = productos.filter(p => {
    const matchClasificacion = filtroClasificacion ? p.clasificacion === filtroClasificacion : true
    const matchEstado = filtroEstado ? p.estado === filtroEstado : true
    return matchClasificacion && matchEstado
  })

  const abrirConfigurarProveedores = async (producto) => {
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
        productoId: modalProveedores.id,
        leadTimeEspecifico: Number(nuevoProvProd.leadTimeEspecifico),
        precioCompraReferencial: Number(nuevoProvProd.precioCompraReferencial),
        cantidadMinimaCompra: Number(nuevoProvProd.cantidadMinimaCompra),
        multiploEmpaque: Number(nuevoProvProd.multiploEmpaque),
      })
      const actualizados = await listarPorProducto(modalProveedores.id)
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

  const columnas = [
    { campo: 'codigoInterno', encabezado: 'Código', render: (r) => <span className="font-mono text-xs font-medium">{r.codigoInterno}</span> },
    { campo: 'nombreComercial', encabezado: 'Nombre Comercial' },
    { campo: 'principioActivoDisplay', encabezado: 'Principio Activo' },
    { campo: 'formaDisplay', encabezado: 'Forma', render: (r) => <span className="capitalize">{r.formaDisplay}</span> },
    { campo: 'concentracionDisplay', encabezado: 'Concentración' },
    { campo: 'presentacionDisplay', encabezado: 'Presentación' },
    { campo: 'clasificacion', encabezado: 'Clasificación', render: (r) => <Insignia color={COLORES_CLASIFICACION[r.clasificacion]}>{ETIQUETAS_CLASIFICACION[r.clasificacion]}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO[r.estado]}>{ETIQUETAS_ESTADO[r.estado]}</Insignia> },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Truck} onClick={() => abrirConfigurarProveedores(r)} title="Configurar Lead Times" className="text-marca-principal hover:bg-marca-claro" />
        </div>
      ),
    },
  ]

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando catálogo...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Catálogo de Productos</h1>
          <p className="text-secundario mt-1">{datosFiltrados.length} productos encontrados</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/catalogo/nuevo')}>Agregar producto</Boton>
      </div>

      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}
      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <div className="flex gap-4">
        <select value={filtroClasificacion} onChange={e => setFiltroClasificacion(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas las clasificaciones</option>
          {OPCIONES_CLASIFICACION.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="descontinuado">Descontinuado</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={datosFiltrados} alClickFila={(p) => navegar(`/central/inventario/catalogo/${p.id}`)} />

      <Modal abierto={!!modalProveedores} alCerrar={() => setModalProveedores(null)} titulo={`Configurar Lead Times — ${modalProveedores?.nombreComercial || ''}`}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secundario">Lead time (días)</label>
                <input type="number" min="1" value={nuevoProvProd.leadTimeEspecifico} onChange={e => setNuevoProvProd({ ...nuevoProvProd, leadTimeEspecifico: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
              <div>
                <label className="text-xs text-secundario">Precio compra (S/)</label>
                <input type="number" min="0.01" step="0.01" value={nuevoProvProd.precioCompraReferencial} onChange={e => setNuevoProvProd({ ...nuevoProvProd, precioCompraReferencial: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModalProveedores(null)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarConfigProveedores}>Guardar configuración</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
