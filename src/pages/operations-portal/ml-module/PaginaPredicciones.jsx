import Tarjeta from '@/components/common/Tarjeta'
import GraficaArea from '@/components/charts/GraficaArea'
import { predicciones } from '@/mock-data/predicciones'
import { boticas } from '@/mock-data/boticas'

export default function PaginaPredicciones() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Predicciones de Demanda</h1>
        <p className="text-secundario mt-1">Pronósticos del modelo ML para toda la red</p>
      </div>

      {predicciones.length === 0 ? (
        <p className="text-secundario">No hay predicciones disponibles</p>
      ) : (
        <div className="space-y-6">
          {predicciones.map(pred => {
            const botica = boticas.find(b => b.id === pred.boticaId)
            return (
              <Tarjeta key={pred.id} titulo={pred.nombreProducto} descripcion={`${botica?.nombre || pred.boticaId} — MAPE: ${pred.metricas?.mape || 'N/A'}%`}>
                <div className="mb-4">
                  <GraficaArea datos={
                    (pred.serieHistorica || []).map(h => ({ mes: h.mes, real: h.real, predicho: null }))
                      .concat((pred.pronostico || []).map(p => ({ mes: p.mes, real: null, predicho: p.predicho })))
                  } altura={200} />
                </div>
                {(pred.pronostico || []).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-cuerpo">
                      <thead>
                        <tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                          <th className="pb-2">Período</th>
                          <th className="pb-2 text-right">Demanda Estimada</th>
                          <th className="pb-2 text-right">Intervalo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pred.pronostico.map(p => (
                          <tr key={p.mes} className="border-b border-estilo last:border-0">
                            <td className="py-2">{p.mes}</td>
                            <td className="py-2 text-right font-semibold text-marca-principal">{p.predicho} uds</td>
                            <td className="py-2 text-right text-etiqueta text-secundario">{p.intervaloInf || '-'} — {p.intervaloSup || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tarjeta>
            )
          })}
        </div>
      )}
    </div>
  )
}
