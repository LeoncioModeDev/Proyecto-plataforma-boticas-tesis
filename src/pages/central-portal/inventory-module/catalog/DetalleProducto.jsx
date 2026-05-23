import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import { productos } from '@/mock-data/productos'
import { stock } from '@/mock-data/stock'
import { lotes } from '@/mock-data/lotes'
import { boticas } from '@/mock-data/boticas'
import { ETIQUETAS_CLASIFICACION, COLORES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { ETIQUETAS_ESTADO, COLORES_ESTADO } from '@/constants/estadoProducto'
import { formatearFechaCorta, diasRestantes } from '@/utilities/formatearFecha'

export default function DetalleProducto() {
  const { id } = useParams()
  const navegar = useNavigate()
  const producto = productos.find(p => p.id === id)

  if (!producto) return <SinDatos titulo="Producto no encontrado" descripcion="El producto solicitado no existe." textoAccion="Volver al catálogo" alAccionar={() => navegar('/central/inventario/catalogo')} />

  const stockProducto = stock.filter(s => s.productoId === id)
  const lotesProducto = lotes.filter(l => l.productoId === id)
  const obtenerNombreUbicacion = (ubId) => boticas.find(b => b.id === ubId)?.nombre || ubId

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <h1 className="text-h1 text-principal">{producto.nombreComercial}</h1>
        <Insignia color={COLORES_ESTADO[producto.estado]}>{ETIQUETAS_ESTADO[producto.estado]}</Insignia>
        <div className="ml-auto">
          <Boton variante="primario" icono={Edit} onClick={() => navegar(`/central/inventario/catalogo/${producto.id}/editar`)}>Editar</Boton>
        </div>
      </div>
      <Tarjeta titulo="Información del Producto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
          {[
            ['Principio Activo', producto.principioActivo],
            ['Forma Farmacéutica', producto.formaFarmaceutica],
            ['Concentración', producto.concentracion],
            ['Laboratorio', producto.laboratorio],
            ['Código de Barras', producto.codigoBarras || '—'],
            ['Clasificación', <Insignia key="c" color={COLORES_CLASIFICACION[producto.clasificacion]}>{ETIQUETAS_CLASIFICACION[producto.clasificacion]}</Insignia>],
          ].map(([label, val], i) => (
            <div key={i}><p className="text-etiqueta text-secundario">{label}</p><p className="text-cuerpo text-principal mt-0.5">{val}</p></div>
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
    </div>
  )
}
