import { useState, useMemo } from 'react'
import Tarjeta from '@/components/common/Tarjeta'
import GraficaArea from '@/components/charts/GraficaArea'
import Insignia from '@/components/common/Insignia'
import { predicciones } from '@/mock-data/predicciones'

/**
 * Página de predicciones de demanda con gráfica de intervalos de confianza.
 */
export default function PaginaPredicciones() {
  const [seleccionado, setSeleccionado] = useState(predicciones[0]?.id || '')
  const pred = predicciones.find(p => p.id === seleccionado)

  const datosGrafica = useMemo(() => {
    if (!pred) return []
    const historicos = pred.serieHistorica.map(h => ({ mes: h.mes, real: h.real, predicho: null, intervaloInf: null, intervaloSup: null }))
    const pronosticos = pred.pronostico.map(p => ({ mes: p.mes, real: null, predicho: p.predicho, intervaloInf: p.intervaloInf, intervaloSup: p.intervaloSup }))
    return [...historicos, ...pronosticos]
  }, [pred])

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Predicciones de Demanda</h1>
      <p className="text-cuerpo text-neutro-gris-texto">Modelo híbrido SARIMA + XGBoost</p>

      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-etiqueta font-medium text-neutro-negro-suave">Producto</label>
          <select value={seleccionado} onChange={e => setSeleccionado(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton min-w-[300px]">
            {predicciones.map(p => <option key={p.id} value={p.id}>{p.nombreProducto} — {p.nombreBotica}</option>)}
          </select>
        </div>
        {pred && (
          <div className="flex gap-2">
            <Insignia color="verde">MAPE: {pred.metricas.mape}%</Insignia>
            <Insignia color="azul">RMSE: {pred.metricas.rmse}</Insignia>
          </div>
        )}
      </div>

      {pred && (
        <>
          <Tarjeta titulo={`Tendencia y Pronóstico — ${pred.nombreProducto}`} descripcion={pred.nombreBotica}>
            <GraficaArea datos={datosGrafica} altura={350} />
          </Tarjeta>

          <Tarjeta titulo="Detalle del Pronóstico">
            <div className="overflow-x-auto">
              <table className="w-full text-cuerpo">
                <thead><tr className="text-left text-etiqueta text-neutro-gris-texto border-b border-neutro-gris-borde">
                  <th className="pb-2">Período</th><th className="pb-2 text-right">Predicción</th><th className="pb-2 text-right">Límite Inferior</th><th className="pb-2 text-right">Límite Superior</th><th className="pb-2 text-right">Rango</th>
                </tr></thead>
                <tbody>
                  {pred.pronostico.map(p => (
                    <tr key={p.mes} className="border-b border-neutro-gris-borde last:border-0 hover:bg-marca-claro transition-colors">
                      <td className="py-2.5">{p.mes}</td>
                      <td className="py-2.5 text-right font-semibold text-marca-principal">{p.predicho}</td>
                      <td className="py-2.5 text-right text-neutro-gris-texto">{p.intervaloInf}</td>
                      <td className="py-2.5 text-right text-neutro-gris-texto">{p.intervaloSup}</td>
                      <td className="py-2.5 text-right">±{Math.round((p.intervaloSup - p.intervaloInf) / 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </>
      )}
    </div>
  )
}
