import { Calendar } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import useAutenticacion from '@/state/useAutenticacion'
import { predicciones } from '@/mock-data/predicciones'
import { filtrarPorBoticaId } from '@/utilities/permisos'

export default function PaginaRecomendacionesBotica() {
  const { usuario } = useAutenticacion()
  const recomendaciones = filtrarPorBoticaId(usuario, predicciones, 'boticaId')
    .map(pred => {
      const proximo = pred.pronostico[0]
      return {
        id: pred.id,
        producto: pred.nombreProducto,
        cantidadSugerida: proximo ? Math.ceil(proximo.predicho * 1.1) : 0,
        fechaLimite: proximo?.mes || '',
        justificacion: `El modelo predice una demanda de ${proximo?.predicho} unidades (±${Math.round((proximo?.intervaloSup - proximo?.intervaloInf) / 2)}) para ${proximo?.mes}. Se recomienda un 10% adicional como margen de seguridad.`,
      }
    })

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Recomendaciones de Reposición</h1>
      <p className="text-cuerpo text-secundario">Sugerencias automáticas basadas en el modelo predictivo</p>

      {recomendaciones.length === 0 ? (
        <p className="text-secundario">No hay recomendaciones disponibles para esta botica</p>
      ) : (
        <div className="space-y-4">
          {recomendaciones.map(rec => (
            <Tarjeta key={rec.id}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-h3 text-principal mb-2">{rec.producto}</h3>
                  <div className="flex items-center gap-4 text-secundario mb-3">
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
      )}
    </div>
  )
}
