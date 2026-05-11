import Insignia from '@/components/common/Insignia'
import { alertas } from '@/mock-data/alertas'
import { ETIQUETAS_ALERTA, COLORES_ALERTA } from '@/constants/tiposAlerta'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { AlertTriangle, TrendingUp, Clock, BrainCircuit } from 'lucide-react'

const ICONOS = { quiebre: AlertTriangle, sobrestock: TrendingUp, vencimiento: Clock, prediccion: BrainCircuit }

export default function PaginaAlertas() {
  const alertasReglas = alertas.filter(a => a.tipo !== 'prediccion')
  const alertasPredictivas = alertas.filter(a => a.tipo === 'prediccion')

  const renderAlerta = (alerta) => {
    const Icono = ICONOS[alerta.tipo] || AlertTriangle
    return (
      <div key={alerta.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-fondo-secundario border border-estilo rounded-lg hover:border-marca-principal transition-colors">
        <div className="p-2 bg-fondo rounded-lg shrink-0">
          <Icono className="h-5 w-5 text-secundario" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Insignia color={COLORES_ALERTA[alerta.tipo]}>{ETIQUETAS_ALERTA[alerta.tipo]}</Insignia>
            <Insignia color={alerta.urgencia === 'critica' ? 'rojo' : alerta.urgencia === 'alta' ? 'amarillo' : 'gris'}>{alerta.urgencia}</Insignia>
          </div>
          <p className="text-sm text-principal">{alerta.mensaje}</p>
          <p className="text-xs text-secundario mt-1">{formatearFechaRelativa(alerta.fechaCreacion)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-h1 text-principal font-semibold">Alertas Inteligentes</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas por Reglas ({alertasReglas.length})</h2>
          {alertasReglas.map(renderAlerta)}
        </div>
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas Predictivas ({alertasPredictivas.length})</h2>
          {alertasPredictivas.map(renderAlerta)}
        </div>
      </div>
    </div>
  )
}
