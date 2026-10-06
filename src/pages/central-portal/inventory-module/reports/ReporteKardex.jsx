import { useState, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { obtenerProductos } from '@/services/supabase/productos'
import { ETIQUETAS_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import { exportarCSV, exportarExcel, exportarPDF } from '@/utilities/exportarArchivo'

export default function ReporteKardex() {
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [productoId, setProductoId] = useState('')

  useEffect(() => {
    Promise.all([
      obtenerProductos({ activos: true }),
      obtenerMovimientos(),
    ]).then(([prodData, movData]) => {
      setProductos(prodData)
      setMovimientos(movData)
      if (prodData.length > 0) setProductoId(prodData[0].id)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  const filas = useMemo(() => {
    if (!productoId) return []
    const movProducto = movimientos
      .filter(m => m.productoId === productoId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    let saldo = 0
    const resultado = []
    for (const m of movProducto) {
      const entrada = m.tipo === 'entrada' ? m.cantidad : 0
      const salida = m.tipo !== 'entrada' ? Math.abs(m.cantidad) : 0
      saldo = saldo + entrada - salida
      resultado.push({ ...m, entrada, salida, saldo })
    }
    return resultado
  }, [productoId, movimientos])

  const producto = productos.find(p => p.id === productoId)

  const filasExport = useMemo(() => filas.map(f => ({
    Fecha: formatearFechaHora(f.createdAt),
    Operación: ETIQUETAS_MOVIMIENTO[f.tipo],
    Entrada: f.entrada || '',
    Salida: f.salida || '',
    Saldo: f.saldo,
  })), [filas])

  const columnasPDF = [
    { acceso: 'Fecha', etiqueta: 'Fecha' },
    { acceso: 'Operación', etiqueta: 'Operación' },
    { acceso: 'Entrada', etiqueta: 'Entrada' },
    { acceso: 'Salida', etiqueta: 'Salida' },
    { acceso: 'Saldo', etiqueta: 'Saldo' },
  ]

  function handleExportar(tipo) {
    if (!filasExport.length) return
    const nombre = `kardex-${producto?.nombreComercial?.replace(/\s+/g, '_') || productoId}`
    if (tipo === 'csv') exportarCSV(filasExport, nombre)
    else if (tipo === 'xlsx') exportarExcel(filasExport, nombre)
    else exportarPDF(`Kardex — ${producto?.nombreComercial}`, columnasPDF, filasExport, nombre)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Reporte de Kardex</h1>
        <div className="flex gap-2">
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('csv')}>CSV</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('xlsx')}>Excel</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('pdf')}>PDF</Boton>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-principal">Producto</label>
        <select
          value={productoId}
          onChange={e => setProductoId(e.target.value)}
          className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md max-w-xs"
        >
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
        </select>
      </div>
      <Tarjeta titulo={`Kardex — ${producto?.nombreComercial || 'Cargando...'}`}>
        {cargando ? (
          <p className="text-secundario text-sm text-center py-8">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-secundario border-b border-estilo">
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Operación</th>
                  <th className="pb-2 pr-4 text-right">Entrada</th>
                  <th className="pb-2 pr-4 text-right">Salida</th>
                  <th className="pb-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-secundario">Sin movimientos para este producto</td></tr>
                ) : filas.map((f, i) => (
                  <tr key={i} className="border-b border-estilo last:border-0 hover:bg-marca-claro transition-colors">
                    <td className="py-2.5 pr-4 text-principal">{formatearFechaHora(f.createdAt)}</td>
                    <td className="py-2.5 pr-4 text-principal">{ETIQUETAS_MOVIMIENTO[f.tipo]}</td>
                    <td className="py-2.5 pr-4 text-right text-marca-principal font-medium">{f.entrada || ''}</td>
                    <td className="py-2.5 pr-4 text-right text-estado-critico font-medium">{f.salida || ''}</td>
                    <td className="py-2.5 text-right font-semibold text-principal">{f.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
