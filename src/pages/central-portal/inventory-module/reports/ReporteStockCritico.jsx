import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import { stock } from '@/mock-data/stock'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'

export default function ReporteStockCritico() {
  const criticos = stock.filter(s => s.cantidadDisponible < s.stockMinimo).map(s => ({
    ...s,
    nombreProducto: productos.find(p => p.id === s.productoId)?.nombreComercial || s.productoId,
    nombreUbicacion: boticas.find(b => b.id === s.ubicacionId)?.nombre || s.ubicacionId,
    faltante: s.stockMinimo - s.cantidadDisponible,
  })).sort((a, b) => b.faltante - a.faltante)

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Reporte de Stock Crítico</h1>
      <p className="text-cuerpo text-secundario">{criticos.length} productos por debajo del stock mínimo</p>
      <Tarjeta>
        <div className="overflow-x-auto">
          <table className="w-full text-cuerpo">
            <thead><tr className="text-left text-etiqueta text-secundario border-b border-estilo">
              <th className="pb-2">Producto</th><th className="pb-2">Ubicación</th><th className="pb-2 text-right">Disponible</th><th className="pb-2 text-right">Mínimo</th><th className="pb-2 text-right">Faltante</th><th className="pb-2">Estado</th>
            </tr></thead>
            <tbody>
              {criticos.map(c => (
                <tr key={c.id} className="border-b border-estilo last:border-0 hover:bg-marca-claro transition-colors">
                  <td className="py-2.5 font-medium">{c.nombreProducto}</td>
                  <td className="py-2.5">{c.nombreUbicacion}</td>
                  <td className="py-2.5 text-right">{c.cantidadDisponible}</td>
                  <td className="py-2.5 text-right">{c.stockMinimo}</td>
                  <td className="py-2.5 text-right font-semibold text-estado-critico">{c.faltante}</td>
                  <td className="py-2.5"><Insignia color={c.cantidadDisponible === 0 ? 'rojo' : 'amarillo'}>{c.cantidadDisponible === 0 ? 'Sin Stock' : 'Bajo Stock'}</Insignia></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
