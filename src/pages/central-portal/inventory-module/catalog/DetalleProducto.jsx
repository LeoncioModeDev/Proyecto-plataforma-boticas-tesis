import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Edit, Truck } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import { productos } from '@/mock-data/productos'
import { productoPrincipioActivo as ppaMock } from '@/mock-data/producto-principio-activo'
import { principiosActivos as paMock } from '@/mock-data/principios-activos'
import { unidadesMedida as umMock } from '@/mock-data/unidades-medida'
import { formasFarmaceuticas as ffMock } from '@/mock-data/formas-farmaceuticas'
import { stock } from '@/mock-data/stock'
import { lotes } from '@/mock-data/lotes'
import { boticas } from '@/mock-data/boticas'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'
import { proveedores as provMock } from '@/mock-data/proveedores'
import { proveedorProducto as ppMock } from '@/mock-data/proveedor-producto'

export default function DetalleProducto() {
  const { id } = useParams()
  const navegar = useNavigate()
  const producto = productos.find(p => p.id === id)

  const [modalProveedores, setModalProveedores] = useState(null)
  const [proveedoresProducto, setProveedoresProducto] = useState([])
  const [nuevoProvProd, setNuevoProvProd] = useState({ proveedorId: '', leadTimeEspecifico: '', precioReferencial: '' })
  const [exito, setExito] = useState(null)

  if (!producto) return <SinDatos titulo="Producto no encontrado" descripcion="El producto solicitado no existe." textoAccion="Volver al catálogo" alAccionar={() => navegar('/central/inventario/catalogo')} />

  const relacionesPa = ppaMock.filter(r => r.productoId === id)
  const infoPrincipios = relacionesPa.map(r => {
    const pa = paMock.find(a => a.id === r.principioActivoId)
    const um = umMock.find(u => u.id === r.unidadMedidaId)
    return {
      nombre: pa?.nombre || 'Desconocido',
      concentracion: r.concentracion,
      unidad: um?.simbolo || '',
    }
  })

  const forma = ffMock.find(f => f.id === producto.formaFarmaceuticaId)
  const formaDisplay = forma ? forma.nombre.charAt(0).toUpperCase() + forma.nombre.slice(1) : producto.formaFarmaceuticaId

  const abrirConfigurarProveedores = () => {
    const existentes = ppMock.filter(r => r.productoId === producto.id)
    setProveedoresProducto(existentes)
    setModalProveedores(producto)
  }

  const agregarProveedorProducto = () => {
    if (!nuevoProvProd.proveedorId || !nuevoProvProd.leadTimeEspecifico || !nuevoProvProd.precioReferencial) return
    const nuevo = {
      id: crypto.randomUUID(),
      proveedorId: nuevoProvProd.proveedorId,
      productoId: producto.id,
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

  const stockProducto = stock.filter(s => s.productoId === id)
  const lotesProducto = lotes.filter(l => l.productoId === id)
  const obtenerNombreUbicacion = (ubId) => boticas.find(b => b.id === ubId)?.nombre || ubId

  return (
    <div className="space-y-6 max-w-4xl">
      {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/inventario/catalogo')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{producto.nombreComercial}</h1>
        <Insignia color={COLORES_ESTADO[producto.estado]}>{ETIQUETAS_ESTADO[producto.estado]}</Insignia>
        <div className="ml-auto flex gap-2">
          <Boton variante="secundario" icono={Truck} onClick={abrirConfigurarProveedores}>Configurar Lead Times</Boton>
          <Boton variante="primario" icono={Edit} onClick={() => navegar(`/central/inventario/catalogo/${producto.id}/editar`)}>Editar</Boton>
        </div>
      </div>
      <Tarjeta titulo="Información del Producto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
          {[
            ['Código Interno', producto.codigoInterno],
            ['Principios Activos', infoPrincipios.map((p, i) => (
              <div key={i} className="mb-1">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-secundario ml-1">({p.concentracion} {p.unidad})</span>
              </div>
            ))],
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
      <Tarjeta titulo="Stock por Ubicación">
        {stockProducto.length === 0 ? <p className="text-secundario">Sin registros de stock</p> : (
          <div className="divide-y divide-estilo">
            {stockProducto.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <span className="text-cuerpo">{obtenerNombreUbicacion(s.ubicacionId)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-cuerpo font-semibold">{s.cantidadDisponible} uds</span>
                  <span className="text-etiqueta text-secundario">Mín: {s.stockMinimo}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Lotes Activos">
        {lotesProducto.length === 0 ? <p className="text-secundario">Sin lotes registrados</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-cuerpo">
              <thead><tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                <th className="pb-2">Lote</th><th className="pb-2">Ubicación</th><th className="pb-2">Cantidad</th><th className="pb-2">Vencimiento</th><th className="pb-2">Días Rest.</th>
              </tr></thead>
              <tbody>
                {lotesProducto.map(l => {
                  const dias = diasRestantes(l.fechaVencimiento)
                  return (
                    <tr key={l.id} className="border-b border-estilo last:border-0">
                      <td className="py-2">{l.numeroLote}</td>
                      <td className="py-2">{obtenerNombreUbicacion(l.ubicacionId)}</td>
                      <td className="py-2">{l.cantidad}</td>
                      <td className="py-2">{formatearFechaCorta(l.fechaVencimiento)}</td>
                      <td className="py-2"><Insignia color={dias < 30 ? 'rojo' : dias < 90 ? 'amarillo' : 'verde'}>{dias} días</Insignia></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Modal abierto={!!modalProveedores} alCerrar={() => setModalProveedores(null)} titulo={`Configurar Lead Times — ${producto.nombreComercial}`}>
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
