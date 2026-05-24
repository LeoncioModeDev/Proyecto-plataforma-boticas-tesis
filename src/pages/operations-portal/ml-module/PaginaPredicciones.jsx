import { useState, useMemo } from 'react'
import Tarjeta from '@/components/common/Tarjeta'
import GraficaArea from '@/components/charts/GraficaArea'
import Insignia from '@/components/common/Insignia'
import { predicciones } from '@/mock-data/predicciones'
import { boticas } from '@/mock-data/boticas'

export default function PaginaPredicciones() {
  const [seleccionado, setSeleccionado] = useState(predicciones[0]?.id || '')
  const pred = predicciones.find(p => p.id === seleccionado)
  const botica = pred ? boticas.find(b => b.id === pred.boticaId) : null

  const datosGrafica = useMemo(() => {
    if (!pred) return []
    const historicos = (pred.serieHistorica || []).map(h => ({ mes: h.mes, real: h.real, predicho: null, intervaloInf: null, intervaloSup: null }))
    const pronosticos = (pred.pronostico || []).map(p => ({ mes: p.mes, real: null, predicho: p.predicho, intervaloInf: p.intervaloInf, intervaloSup: p.intervaloSup }))
    return [...historicos, ...pronosticos]
  }, [pred])

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Predicciones de Demanda</h1>
      <p className="text-secundario">Pronósticos del modelo ML para toda la red</p>

      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-etiqueta font-medium text-principal">Producto</label>
          <select value={seleccionado} onChange={e => setSeleccionado(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md min-w-[300px]">
            {predicciones.map(p => {
              const b = boticas.find(bi => bi.id === p.boticaId)
              return <option key={p.id} value={p.id}>{p.nombreProducto} — {b?.nombre || p.boticaId}</option>
            })}
          </select>
        </div>
        {pred && (
          <div className="flex gap-2">
            <Insignia color="verde">MAPE: {pred.metricas?.mape || 'N/A'}%</Insignia>
          </div>
        )}
      </div>

      {!pred ? (
        <p className="text-secundario">No hay predicciones disponibles</p>
      ) : (
        <Tarjeta titulo={`${pred.nombreProducto}`} descripcion={botica?.nombre || pred.boticaId}>
          <div className="mb-4">
            <GraficaArea datos={datosGrafica} altura={250} />
          </div>
          {(pred.pronostico || []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-cuerpo">
                <thead>
                  <tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                    <th className="pb-2">Período</th>
                    <th className="pb-2 text-right">Demanda Estimada</th>
                    <th className="pb-2 text-right">Límite Inferior</th>
                    <th className="pb-2 text-right">Límite Superior</th>
                    <th className="pb-2 text-right">Rango</th>
                  </tr>
                </thead>
                <tbody>
                  {pred.pronostico.map(p => (
                    <tr key={p.mes} className="border-b border-estilo last:border-0 hover:bg-marca-claro transition-colors">
                      <td className="py-2.5">{p.mes}</td>
                      <td className="py-2.5 text-right font-semibold text-marca-principal">{p.predicho} uds</td>
                      <td className="py-2.5 text-right text-secundario">{p.intervaloInf || '-'}</td>
                      <td className="py-2.5 text-right text-secundario">{p.intervaloSup || '-'}</td>
                      <td className="py-2.5 text-right">±{p.intervaloInf && p.intervaloSup ? Math.round((p.intervaloSup - p.intervaloInf) / 2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  )
}
