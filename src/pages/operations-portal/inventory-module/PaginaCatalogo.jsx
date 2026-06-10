import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ToggleLeft, ToggleRight, Truck } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { productos as productosMock } from '@/mock-data/productos'
import { productoPrincipioActivo as ppaMock } from '@/mock-data/producto-principio-activo'
import { principiosActivos as paMock } from '@/mock-data/principios-activos'
import { unidadesMedida as umMock } from '@/mock-data/unidades-medida'
import { formasFarmaceuticas as ffMock } from '@/mock-data/formas-farmaceuticas'
import { proveedores as provMock } from '@/mock-data/proveedores'
import { proveedorProducto as ppMock } from '@/mock-data/proveedor-producto'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'

function enriquecerProductos() {
  return productosMock.map(p => {
    const relaciones = ppaMock.filter(r => r.productoId === p.id)
    const paInfo = relaciones.map(r => {
      const pa = paMock.find(a => a.id === r.principioActivoId)
      const um = umMock.find(u => u.id === r.unidadMedidaId)
      return {
        nombre: pa?.nombre || '',
        concentracion: r.concentracion,
        unidad: um?.simbolo || '',
      }
    })
    const ff = ffMock.find(f => f.id === p.formaFarmaceuticaId)
    return {
      ...p,
      principioActivoDisplay: paInfo.map(i => i.nombre).join(', '),
      concentracionDisplay: paInfo.map(i => `${i.concentracion} ${i.unidad}`).join(', '),
      formaDisplay: ff?.nombre || p.formaFarmaceuticaId,
      presentacionDisplay: p.presentacion || '—',
    }
  })
}

export default function PaginaCatalogo() {
  const navegar = useNavigate()
  const [productos, setProductos] = useState(enriquecerProductos)
  const [exito, setExito] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [modalProveedores, setModalProveedores] = useState(null)
  const [proveedoresProducto, setProveedoresProducto] = useState([])
  const [nuevoProvProd, setNuevoProvProd] = useState({ proveedorId: '', leadTimeEspecifico: '', precioReferencial: '' })

  const manejarToggleActivo = (id) => {
    const producto = productos.find(p => p.id === id)
    if (producto.estado === 'activo') {
      setConfirmarDesactivar(id)
    } else {
      setProductos(productos.map(p => p.id === id ? { ...p, estado: 'activo' } : p))
      setExito('Producto activado correctamente')
      setTimeout(() => setExito(null), 2000)
    }
  }

  const confirmarDesactivacion = () => {
    setProductos(productos.map(p => p.id === confirmarDesactivar ? { ...p, estado: 'inactivo' } : p))
    setExito('Producto desactivado correctamente')
    setConfirmarDesactivar(null)
    setTimeout(() => setExito(null), 2000)
  }

  const abrirConfigurarProveedores = (producto) => {
    const existentes = ppMock.filter(r => r.productoId === producto.id)
    setProveedoresProducto(existentes)
    setModalProveedores(producto)
  }

  const agregarProveedorProducto = () => {
    if (!nuevoProvProd.proveedorId || !nuevoProvProd.leadTimeEspecifico || !nuevoProvProd.precioReferencial) return
    const nuevo = {
      id: crypto.randomUUID(),
      proveedorId: nuevoProvProd.proveedorId,
      productoId: modalProveedores.id,
      leadTimeEspecifico: Number(nuevoProvProd.leadTimeEspecifico),
      precioReferencial: Number(nuevoProvProd.precioReferencial),
    }
    setProveedoresProducto([...proveedoresProducto, nuevo])
    setNuevoProvProd({ proveedorId: '', leadTimeEspecifico: '', precioReferencial: '' })
  }

  const eliminarProveedorProducto = (id) => {
    setProveedoresProducto(proveedoresProducto.filter(r => r.id !== id))
  }

  const guardarConfigProveedores = () => {
    setExito('Proveedores configurados correctamente')
    setModalProveedores(null)
    setTimeout(() => setExito(null), 2000)
  }

  const proveedoresDisponibles = provMock.filter(p => p.activo)

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { campo: 'codigoInterno', encabezado: 'Código Interno', render: (r) => <span className="font-mono text-xs">{r.codigoInterno}</span> },
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
          <Boton
            variante="icono"
            icono={r.estado === 'activo' ? ToggleRight : ToggleLeft}
            onClick={() => manejarToggleActivo(r.id)}
            title={r.estado === 'activo' ? 'Desactivar' : 'Activar'}
            className={r.estado === 'activo' ? 'text-estado-critico hover:bg-rojo-claro' : 'text-marca-principal hover:bg-marca-claro'}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Catálogo de Productos</h1>
          <p className="text-secundario mt-1">Gestión global del catálogo de la red</p>
        </div>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/operaciones/inventario/catalogo/nuevo')}>Nuevo producto</Boton>
      </div>

      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}

      <Tabla columnas={columnas} datos={productos} alClickFila={(p) => navegar(`/operaciones/inventario/catalogo/${p.id}`)} />

      <Modal abierto={!!confirmarDesactivar} alCerrar={() => setConfirmarDesactivar(null)} titulo="Confirmar Desactivación">
        <div className="space-y-4">
          <p className="text-cuerpo text-secundario">¿Está seguro de que desea desactivar este producto? El producto no se eliminará, pero quedará inactivo en el catálogo.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setConfirmarDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarDesactivacion}>Desactivar</Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={!!modalProveedores} alCerrar={() => setModalProveedores(null)} titulo={`Configurar Lead Times — ${modalProveedores?.nombreComercial || ''}`}>
        <div className="space-y-4">
          {proveedoresProducto.length === 0 ? (
            <p className="text-secundario">Sin proveedores asociados</p>
          ) : (
            <div className="divide-y divide-estilo max-h-60 overflow-y-auto">
              {proveedoresProducto.map(r => {
                const prov = provMock.find(p => p.id === r.proveedorId)
                return (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{prov?.razonSocial || r.proveedorId}</p>
                      <p className="text-xs text-secundario">Lead time: {r.leadTimeEspecifico} días | S/ {r.precioReferencial}</p>
                    </div>
                    <Boton variante="texto" onClick={() => eliminarProveedorProducto(r.id)} className="text-estado-critico text-sm">Eliminar</Boton>
                  </div>
                )
              })}
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
                <input type="number" value={nuevoProvProd.leadTimeEspecifico} onChange={e => setNuevoProvProd({ ...nuevoProvProd, leadTimeEspecifico: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
              <div>
                <label className="text-xs text-secundario">Precio referencial (S/)</label>
                <input type="number" step="0.01" value={nuevoProvProd.precioReferencial} onChange={e => setNuevoProvProd({ ...nuevoProvProd, precioReferencial: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
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
