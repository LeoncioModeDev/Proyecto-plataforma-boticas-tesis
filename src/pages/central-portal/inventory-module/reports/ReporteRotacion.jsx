import { useState, useEffect, useMemo } from 'react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarBoticas } from '@/services/supabase/boticas'
import { exportarExcel, exportarPDF } from '@/utilities/exportarArchivo'
import { subDays, startOfDay } from 'date-fns'

const OPCIONES_PERIODO = [
  { valor: 7, etiqueta: 'Últimos 7 días' },
  { valor: 30, etiqueta: 'Últimos 30 días' },
  { valor: 60, etiqueta: 'Últimos 60 días' },
  { valor: 90, etiqueta: 'Últimos 90 días' },
]

export default function ReporteRotacion() {
  const [dias, setDias] = useState(30)
  const [movimientos, setMovimientos] = useState([])
  const [stock, setStock] = useState([])
  const [productos, setProductos] = useState([])
  const [boticas, setBoticas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState('producto')

  useEffect(() => {
    Promise.all([
      obtenerMovimientos(),
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      listarBoticas({ activas: true }),
    ]).then(([mov, stk, prod, bot]) => {
      setMovimientos(mov)
      setStock(stk)
      setProductos(prod)
      setBoticas(bot)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  const hoy = new Date()
  const inicio = startOfDay(subDays(hoy, dias))

  const rotacion = useMemo(() => {
    if (vista === 'producto') {
      const salidas = {}
      movimientos.forEach(m => {
        if (m.tipo === 'salida' && new Date(m.createdAt) >= inicio) {
          salidas[m.productoId] = (salidas[m.productoId] || 0) + Math.abs(m.cantidad)
        }
      })

      return Object.entries(salidas).map(([productoId, totalSalidas]) => {
        const producto = productos.find(p => p.id === productoId)
        const stockProducto = stock.filter(s => s.productoId === productoId)
        const totalStock = stockProducto.reduce((sum, s) => sum + s.cantidadDisponible, 0)
        const entradas = movimientos
          .filter(m => m.productoId === productoId && m.tipo === 'entrada' && new Date(m.createdAt) >= inicio)
          .reduce((sum, m) => sum + Math.abs(m.cantidad), 0)
        const stockInicial = totalStock + totalSalidas - entradas
        const stockPromedio = stockInicial > 0 ? (stockInicial + totalStock) / 2 : totalStock
        const indice = stockPromedio > 0 ? +(totalSalidas / stockPromedio).toFixed(2) : 0

        return {
          producto: producto?.nombreComercial || productoId,
          totalSalidas,
          stockActual: totalStock,
          stockInicial,
          stockPromedio: +stockPromedio.toFixed(1),
          indice,
        }
      }).sort((a, b) => b.indice - a.indice)
    }

    // Por botica
    const salidas = {}
    movimientos.forEach(m => {
      if (m.tipo === 'salida' && new Date(m.createdAt) >= inicio) {
        const key = m.ubicacionId || 'drogueria'
        salidas[key] = (salidas[key] || 0) + Math.abs(m.cantidad)
      }
    })

    return Object.entries(salidas).map(([ubicacionId, totalSalidas]) => {
      const botica = boticas.find(b => b.id === ubicacionId)
      const stockUbicacion = stock.filter(s => s.ubicacionId === ubicacionId || (!s.ubicacionId && ubicacionId === 'drogueria'))
      const totalStock = stockUbicacion.reduce((sum, s) => sum + s.cantidadDisponible, 0)
      const entradas = movimientos
        .filter(m => (m.ubicacionId === ubicacionId || (!m.ubicacionId && ubicacionId === 'drogueria')) && m.tipo === 'entrada' && new Date(m.createdAt) >= inicio)
        .reduce((sum, m) => sum + Math.abs(m.cantidad), 0)
      const stockInicial = totalStock + totalSalidas - entradas
      const stockPromedio = stockInicial > 0 ? (stockInicial + totalStock) / 2 : totalStock
      const indice = stockPromedio > 0 ? +(totalSalidas / stockPromedio).toFixed(2) : 0

      return {
        producto: botica?.nombre || ubicacionId,
        totalSalidas,
        stockActual: totalStock,
        stockInicial,
        stockPromedio: +stockPromedio.toFixed(1),
        indice,
      }
    }).sort((a, b) => b.indice - a.indice)
  }, [movimientos, stock, productos, boticas, vista, inicio])

  const columnasExport = [
    { acceso: 'producto', etiqueta: vista === 'producto' ? 'Producto' : 'Botica' },
    { acceso: 'totalSalidas', etiqueta: 'Salidas período' },
    { acceso: 'stockActual', etiqueta: 'Stock actual' },
    { acceso: 'stockPromedio', etiqueta: 'Stock promedio' },
    { acceso: 'indice', etiqueta: 'Índice rotación' },
  ]

  function handleExportarExcel() {
    exportarExcel(rotacion, `rotacion-${dias}d`, `Rotación ${dias}d`)
  }

  function handleExportarPDF() {
    exportarPDF(
      `Reporte de Rotación (${dias} días)`,
      columnasExport,
      rotacion,
      `rotacion-${dias}d`
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Reporte de Rotación</h1>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={handleExportarExcel}>Exportar Excel</Boton>
          <Boton variante="secundario" onClick={handleExportarPDF}>Exportar PDF</Boton>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-principal">Período</label>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md">
            {OPCIONES_PERIODO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-principal">Vista</label>
          <div className="flex gap-1 bg-fondo-secundario rounded-md p-1 border border-estilo">
            <button onClick={() => setVista('producto')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${vista === 'producto' ? 'bg-marca-principal text-white' : 'text-principal hover:bg-fondo'}`}>Por Producto</button>
            <button onClick={() => setVista('botica')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${vista === 'botica' ? 'bg-marca-principal text-white' : 'text-principal hover:bg-fondo'}`}>Por Botica</button>
          </div>
        </div>
      </div>
      <Tarjeta titulo={`Rotación de Inventario — ${dias} días`}>
        {cargando ? (
          <p className="text-secundario text-sm text-center py-8">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-secundario border-b border-estilo">
                  <th className="pb-2 pr-4">{vista === 'producto' ? 'Producto' : 'Botica'}</th>
                  <th className="pb-2 pr-4 text-right">Salidas</th>
                  <th className="pb-2 pr-4 text-right">Stock Actual</th>
                  <th className="pb-2 pr-4 text-right">Stock Promedio</th>
                  <th className="pb-2 text-right">Índice Rotación</th>
                </tr>
              </thead>
              <tbody>
                {rotacion.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-secundario">Sin datos en el período seleccionado</td></tr>
                ) : rotacion.map((r, i) => (
                  <tr key={i} className="border-b border-estilo last:border-0 hover:bg-marca-claro transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-principal">{r.producto}</td>
                    <td className="py-2.5 pr-4 text-right text-principal">{r.totalSalidas}</td>
                    <td className="py-2.5 pr-4 text-right text-principal">{r.stockActual}</td>
                    <td className="py-2.5 pr-4 text-right text-principal">{r.stockPromedio}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                        r.indice >= 3 ? 'bg-verde-claro text-verde-oscuro' :
                        r.indice >= 1 ? 'bg-amarillo-claro text-amarillo-oscuro' :
                        'bg-rojo-claro text-rojo-oscuro'
                      }`}>
                        {r.indice}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Interpretación">
        <p className="text-sm text-secundario">
          <strong className="text-principal">Índice de rotación</strong> = Salidas del período ÷ Stock promedio.
          Un índice alto (&ge;3) indica alta rotación; bajo (&lt;1) indica poca rotación (producto podría estar obsoleto).
        </p>
      </Tarjeta>
    </div>
  )
}
