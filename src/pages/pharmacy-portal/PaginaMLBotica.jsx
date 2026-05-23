import Tarjeta from '@/components/common/Tarjeta'
import GraficaArea from '@/components/charts/GraficaArea'
import useAutenticacion from '@/state/useAutenticacion'
import { predicciones } from '@/mock-data/predicciones'
import { filtrarPorBoticaId } from '@/utilities/permisos'

export default function PaginaMLBotica() {
  const { usuario } = useAutenticacion()
  const prediccionesLocal = filtrarPorBoticaId(usuario, predicciones, 'boticaId')

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Pronóstico de Demanda</h1>
      <p className="text-cuerpo text-secundario">Predicciones y recomendaciones para mi botica</p>

      {prediccionesLocal.length === 0 ? (
        <p className="text-secundario">No hay predicciones disponibles para esta botica</p>
      ) : (
        <div className="space-y-6">
          {prediccionesLocal.map(pred => (
            <Tarjeta key={pred.id} titulo={pred.nombreProducto} descripcion="Pronóstico de demanda estimada">
              <div className="mb-4">
                <GraficaArea datos={
                  pred.serieHistorica.map(h => ({ mes: h.mes, real: h.real, predicho: null }))
                    .concat(pred.pronostico.map(p => ({ mes: p.mes, real: null, predicho: p.predicho })))
                } altura={200} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-cuerpo">
                  <thead>
                    <tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                      <th className="pb-2">Período</th>
                      <th className="pb-2 text-right">Demanda Estimada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pred.pronostico.map(p => (
                      <tr key={p.mes} className="border-b border-estilo last:border-0">
                        <td className="py-2">{p.mes}</td>
                        <td className="py-2 text-right font-semibold text-marca-principal">{p.predicho} uds</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  )
}
