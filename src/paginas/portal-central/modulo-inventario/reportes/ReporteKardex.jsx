import { useState } from 'react'
import { Download } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tarjeta from '@/componentes/comunes/Tarjeta'
import { movimientos } from '@/datos-prueba/movimientos'
import { productos } from '@/datos-prueba/productos'
import { ETIQUETAS_MOVIMIENTO } from '@/constantes/tiposMovimiento'
import { formatearFechaHora } from '@/utilidades/formatearFecha'

/**
 * Reporte de Kardex: historial cronológico de movimientos por producto.
 */
export default function ReporteKardex() {
  const [productoId, setProductoId] = useState('prod-001')
  const movProducto = movimientos.filter(m => m.productoId === productoId).sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora))
  const producto = productos.find(p => p.id === productoId)

  let saldo = 0
  const filas = movProducto.map(m => {
    const entrada = m.tipo === 'entrada' ? m.cantidad : 0
    const salida = m.tipo !== 'entrada' ? Math.abs(m.cantidad) : 0
    saldo += entrada - salida
    return { ...m, entrada, salida, saldo }
  })

  const exportarCSV = () => { console.log('[Mock] Exportar CSV del Kardex:', filas) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Reporte de Kardex</h1>
        <Boton variante="secundario" icono={Download} onClick={exportarCSV}>Exportar CSV</Boton>
      </div>
      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-etiqueta font-medium text-neutro-negro-suave">Producto</label>
          <select value={productoId} onChange={e => setProductoId(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
          </select>
        </div>
      </div>
      <Tarjeta titulo={`Kardex — ${producto?.nombreComercial || ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-cuerpo">
            <thead><tr className="text-left text-etiqueta text-neutro-gris-texto border-b border-neutro-gris-borde">
              <th className="pb-2 pr-4">Fecha</th><th className="pb-2 pr-4">Operación</th><th className="pb-2 pr-4 text-right">Entrada</th><th className="pb-2 pr-4 text-right">Salida</th><th className="pb-2 text-right">Saldo</th>
            </tr></thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-neutro-gris-borde last:border-0 hover:bg-marca-claro transition-colors">
                  <td className="py-2.5 pr-4">{formatearFechaHora(f.fechaHora)}</td>
                  <td className="py-2.5 pr-4">{ETIQUETAS_MOVIMIENTO[f.tipo]}</td>
                  <td className="py-2.5 pr-4 text-right text-marca-principal font-medium">{f.entrada || ''}</td>
                  <td className="py-2.5 pr-4 text-right text-estado-critico font-medium">{f.salida || ''}</td>
                  <td className="py-2.5 text-right font-semibold">{f.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
