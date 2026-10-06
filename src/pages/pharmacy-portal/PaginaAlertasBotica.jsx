import { useEffect } from 'react'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import useAlertas from '@/state/useAlertas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { COLORES_ALERTA, ETIQUETAS_ALERTA } from '@/constants/tiposAlerta'
import { AlertTriangle, Loader2 } from 'lucide-react'

export default function PaginaAlertasBotica() {
  const { usuario } = useAutenticacion()
  const { alertas, cargando, error, cargarAlertas } = useAlertas()

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-marca-principal" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-estado-critico mb-4" />
        <p className="text-cuerpo text-estado-critico">Error al cargar alertas</p>
        <p className="text-sm text-secundario mt-1">{error}</p>
        <button onClick={cargarAlertas} className="mt-4 text-sm text-marca-principal hover:underline">Reintentar</button>
      </div>
    )
  }

  const datos = alertas
    .filter(a => !usuario.boticaId || a.boticaId === usuario.boticaId)
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
