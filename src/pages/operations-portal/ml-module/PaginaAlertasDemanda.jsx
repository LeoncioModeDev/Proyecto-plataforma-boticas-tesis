import { AlertTriangle, BrainCircuit } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { predicciones } from '@/mock-data/predicciones'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const alertasDemandaMock = predicciones.filter(p => p.metricas?.mape > 20).map(p => ({
  id: p.id,
  producto: p.nombreProducto,
  botica: boticas.find(b => b.id === p.boticaId)?.nombre || p.boticaId,
  mape: p.metricas?.mape || 0,
  tendencia: p.pronostico?.length > 0 && p.pronostico[p.pronostico.length - 1].predicho > (p.serieHistorica?.[p.serieHistorica.length - 1]?.real || 0) ? 'alza' : 'baja',
  fecha: p.updatedAt || new Date().toISOString(),
}))

export default function PaginaAlertasDemanda() {
  const alertasAlta = alertasDemandaMock.filter(a => a.mape > 30).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Alertas de Demanda</h1>
        <p className="text-secundario mt-1">Alertas generadas por el modelo ML sobre patrones de demanda</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Alertas Activas" valor={alertasDemandaMock.length} icono={BrainCircuit} />
        <TarjetaMetrica etiqueta="Alta Dispersión" valor={alertasAlta} icono={AlertTriangle} />
      </div>

      <div className="space-y-4">
        {alertasDemandaMock.length === 0 ? (
          <p className="text-secundario">No hay alertas de demanda activas</p>
        ) : (
          alertasDemandaMock.map(a => (
            <div key={a.id} className="flex items-start gap-4 p-4 bg-fondo-secundario border border-estilo rounded-lg">
              <div className="p-2 bg-marca-claro rounded-full">
                <BrainCircuit className="h-5 w-5 text-marca-principal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-cuerpo text-principal font-medium">{a.producto}</p>
                <p className="text-etiqueta text-secundario">{a.botica}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Insignia color={a.mape > 30 ? 'rojo' : a.mape > 20 ? 'amarillo' : 'verde'}>MAPE: {a.mape}%</Insignia>
                  <Insignia color={a.tendencia === 'alza' ? 'azul' : 'gris'}>
                    Tendencia: {a.tendencia === 'alza' ? 'Al alza' : 'A la baja'}
                  </Insignia>
                  <span className="text-etiqueta text-secundario">{formatearFechaRelativa(a.fecha)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
