import { Calendar, MapPin } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import { predicciones } from '@/mock-data/predicciones'

export default function PaginaRecomendaciones() {
  const recomendaciones = predicciones.map(pred => {
    const proximo = pred.pronostico[0]
    return {
      id: pred.id,
      producto: pred.nombreProducto,
      botica: pred.nombreBotica,
      cantidadSugerida: proximo ? Math.ceil(proximo.predicho * 1.1) : 0,
      fechaLimite: proximo?.mes || '',
      confianza: pred.metricas.mape < 10 ? 'Alta' : pred.metricas.mape < 15 ? 'Media' : 'Baja',
      colorConfianza: pred.metricas.mape < 10 ? 'verde' : pred.metricas.mape < 15 ? 'amarillo' : 'rojo',
      justificacion: `El modelo predice una demanda de ${proximo?.predicho} unidades (±${Math.round((proximo?.intervaloSup - proximo?.intervaloInf) / 2)}) para ${proximo?.mes}. Se recomienda un 10% adicional como margen de seguridad.`,
    }
  })

  const totalSugerido = recomendaciones.reduce((sum, r) => sum + r.cantidadSugerida, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Recomendaciones de Reposición</h1>
          <p className="text-cuerpo text-secundario">Sugerencias automáticas basadas en el modelo SARIMA + XGBoost</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-secundario">Total sugerido</p>
          <p className="text-h3 text-marca-principal">{totalSugerido} uds</p>
        </div>
      </div>

      <div className="space-y-4">
        {recomendaciones.map(rec => (
          <Tarjeta key={rec.id}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-h3 text-principal">{rec.producto}</h3>
                  <Insignia color={rec.colorConfianza}>Confianza {rec.confianza}</Insignia>
                </div>
                <div className="flex items-center gap-4 text-secundario mb-3">
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{rec.botica}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Antes de {rec.fechaLimite}</span>
                </div>
                <p className="text-cuerpo text-principal">{rec.justificacion}</p>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="text-center">
                  <p className="text-h1 text-marca-principal">{rec.cantidadSugerida}</p>
                  <p className="text-etiqueta text-secundario">unidades sugeridas</p>
                </div>
              </div>
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
