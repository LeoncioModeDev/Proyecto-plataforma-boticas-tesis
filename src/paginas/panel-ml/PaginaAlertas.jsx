import Tarjeta from '@/componentes/comunes/Tarjeta'
import Insignia from '@/componentes/comunes/Insignia'
import { alertas } from '@/datos-prueba/alertas'
import { ETIQUETAS_ALERTA, COLORES_ALERTA } from '@/constantes/tiposAlerta'
import { formatearFechaRelativa } from '@/utilidades/formatearFecha'
import { AlertTriangle, TrendingUp, Clock, BrainCircuit } from 'lucide-react'

const ICONOS = { quiebre: AlertTriangle, sobrestock: TrendingUp, vencimiento: Clock, prediccion: BrainCircuit }

/**
 * Página de alertas inteligentes con distinción entre reglas y predictivas.
 */
export default function PaginaAlertas() {
  const alertasReglas = alertas.filter(a => a.tipo !== 'prediccion')
  const alertasPredictivas = alertas.filter(a => a.tipo === 'prediccion')

  const renderAlerta = (alerta) => {
    const Icono = ICONOS[alerta.tipo] || AlertTriangle
    return (
      <div key={alerta.id} className="flex items-start gap-4 p-4 bg-white border border-neutro-gris-borde rounded-tarjeta hover:border-marca-principal transition-colors">
        <div className="p-2 bg-neutro-blanco-suave rounded-tarjeta">
          <Icono className="h-5 w-5 text-neutro-negro-suave" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Insignia color={COLORES_ALERTA[alerta.tipo]}>{ETIQUETAS_ALERTA[alerta.tipo]}</Insignia>
            <Insignia color={alerta.urgencia === 'critica' ? 'rojo' : alerta.urgencia === 'alta' ? 'amarillo' : 'gris'}>{alerta.urgencia}</Insignia>
          </div>
          <p className="text-cuerpo text-neutro-negro">{alerta.mensaje}</p>
          <p className="text-etiqueta text-neutro-gris-texto mt-1">{formatearFechaRelativa(alerta.fechaCreacion)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Alertas Inteligentes</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-h3 text-neutro-negro">Alertas por Reglas ({alertasReglas.length})</h2>
          {alertasReglas.map(renderAlerta)}
        </div>
        <div className="space-y-4">
          <h2 className="text-h3 text-neutro-negro">Alertas Predictivas ({alertasPredictivas.length})</h2>
          {alertasPredictivas.map(renderAlerta)}
        </div>
      </div>
    </div>
  )
}
