import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarBoticas } from '@/services/supabase/boticas'
import { exportarCSV, exportarExcel, exportarPDF } from '@/utilities/exportarArchivo'

export default function ReporteStockCritico() {
  const [criticos, setCriticos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      listarBoticas({ activas: true }),
    ]).then(([stockData, prodData, botData]) => {
      const result = stockData
        .filter(s => s.cantidadDisponible < s.stockMinimo)
        .map(s => ({
          ...s,
          nombreProducto: prodData.find(p => p.id === s.productoId)?.nombreComercial || s.productoId,
          nombreUbicacion: botData.find(b => b.id === s.ubicacionId)?.nombre || s.ubicacionId || 'Droguería Central',
          faltante: s.stockMinimo - s.cantidadDisponible,
        }))
        .sort((a, b) => b.faltante - a.faltante)
      setCriticos(result)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  function handleExportar(tipo) {
    const filas = criticos.map(c => ({
      Producto: c.nombreProducto,
      Ubicación: c.nombreUbicacion,
      Disponible: c.cantidadDisponible,
      'Stock Mínimo': c.stockMinimo,
      Faltante: c.faltante,
      Estado: c.cantidadDisponible === 0 ? 'Sin Stock' : 'Bajo Stock',
    }))
    if (!filas.length) return
    if (tipo === 'csv') exportarCSV(filas, 'stock-critico')
    else if (tipo === 'xlsx') exportarExcel(filas, 'stock-critico')
    else exportarPDF('Reporte de Stock Crítico', Object.keys(filas[0]).map(k => ({ acceso: k, etiqueta: k })), filas, 'stock-critico')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 text-principal">Reporte de Stock Crítico</h1>
          <p className="text-cuerpo text-secundario">{criticos.length} productos por debajo del stock mínimo</p>
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('csv')}>CSV</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('xlsx')}>Excel</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('pdf')}>PDF</Boton>
        </div>
      </div>
      <Tarjeta>
        {cargando ? (
          <p className="text-secundario text-sm text-center py-8">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-cuerpo">
              <thead><tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                <th className="pb-2">Producto</th><th className="pb-2">Ubicación</th><th className="pb-2 text-right">Disponible</th><th className="pb-2 text-right">Mínimo</th><th className="pb-2 text-right">Faltante</th><th className="pb-2">Estado</th>
              </tr></thead>
              <tbody>
                {criticos.map(c => (
                  <tr key={`${c.productoId}-${c.ubicacionId}`} className="border-b border-estilo last:border-0 hover:bg-marca-claro transition-colors">
                    <td className="py-2.5 font-medium">{c.nombreProducto}</td>
                    <td className="py-2.5">{c.nombreUbicacion}</td>
                    <td className="py-2.5 text-right">{c.cantidadDisponible}</td>
                    <td className="py-2.5 text-right">{c.stockMinimo}</td>
                    <td className="py-2.5 text-right font-semibold text-estado-critico">{c.faltante}</td>
                    <td className="py-2.5"><Insignia color={c.cantidadDisponible === 0 ? 'rojo' : 'amarillo'}>{c.cantidadDisponible === 0 ? 'Sin Stock' : 'Bajo Stock'}</Insignia></td>
                  </tr>
                ))}
                {criticos.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-secundario">Sin productos críticos</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
