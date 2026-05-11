import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import { movimientos } from '@/mock-data/movimientos'
import { productos } from '@/mock-data/productos'
import { ETIQUETAS_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'

export default function ReporteKardex() {
  const [productoId, setProductoId] = useState('prod-001')
  
  const filas = useMemo(() => {
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
  }, [productoId])

  const producto = productos.find(p => p.id === productoId)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Reporte de Kardex</h1>
        <Boton variante="secundario" icono={Download} onClick={() => console.log('[Mock] Exportar CSV')}>Exportar CSV</Boton>
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
      <Tarjeta titulo={`Kardex — ${producto?.nombreComercial || ''}`}>
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
              {filas.map((f, i) => (
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
      </Tarjeta>
    </div>
  )
}
