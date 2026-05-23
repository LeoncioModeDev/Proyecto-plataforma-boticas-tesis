import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { alertas } from '@/mock-data/alertas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { COLORES_ALERTA, ETIQUETAS_ALERTA } from '@/constants/tiposAlerta'
import { filtrarPorBoticaId } from '@/utilities/permisos'

export default function PaginaAlertasBotica() {
  const { usuario } = useAutenticacion()
  const datos = filtrarPorBoticaId(usuario, alertas, 'boticaId')
    .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Alertas de mi Botica</h1>
      <p className="text-cuerpo text-secundario">Alertas de stock, vencimientos y notificaciones locales</p>

      {datos.length === 0 ? (
        <p className="text-secundario">Sin alertas para esta botica</p>
      ) : (
        <div className="space-y-4">
          {datos.map(a => (
            <div key={a.id} className="flex items-start gap-4 p-4 bg-fondo-secundario border border-estilo rounded-lg">
              <Insignia color={COLORES_ALERTA[a.tipo]}>{ETIQUETAS_ALERTA[a.tipo]}</Insignia>
              <div className="flex-1 min-w-0">
                <p className="text-cuerpo text-principal">{a.mensaje}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-etiqueta text-secundario">{formatearFechaRelativa(a.fechaCreacion)}</span>
                  {a.urgencia === 'alta' && <Insignia color="rojo">Urgente</Insignia>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
