import { ShoppingCart, Calendar, MapPin } from 'lucide-react'
import Tarjeta from '@/componentes/comunes/Tarjeta'
import Insignia from '@/componentes/comunes/Insignia'
import Boton from '@/componentes/comunes/Boton'
import { predicciones } from '@/datos-prueba/predicciones'

/**
 * Página de recomendaciones automáticas basadas en predicciones del modelo.
 */
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

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Recomendaciones de Reposición</h1>
      <p className="text-cuerpo text-neutro-gris-texto">Sugerencias automáticas basadas en el modelo SARIMA + XGBoost</p>

      <div className="space-y-4">
        {recomendaciones.map(rec => (
          <Tarjeta key={rec.id}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-h3 text-neutro-negro">{rec.producto}</h3>
                  <Insignia color={rec.colorConfianza}>Confianza {rec.confianza}</Insignia>
                </div>
                <div className="flex items-center gap-4 text-secundario text-neutro-gris-texto mb-3">
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{rec.botica}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Antes de {rec.fechaLimite}</span>
                </div>
                <p className="text-cuerpo text-neutro-negro-suave">{rec.justificacion}</p>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="text-center">
                  <p className="text-h1 text-marca-principal">{rec.cantidadSugerida}</p>
                  <p className="text-etiqueta text-neutro-gris-texto">unidades sugeridas</p>
                </div>
                <Boton variante="secundario" tamano="pequeno" icono={ShoppingCart}>Crear orden</Boton>
              </div>
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
