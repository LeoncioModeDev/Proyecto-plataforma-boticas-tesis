import { useEffect, useState } from 'react'
import { obtenerAlertaVencimiento } from '@/services/supabase/configuracion'
import useAutenticacion from '@/state/useAutenticacion'
import useConfiguracion, { ALERTA_VENCIMIENTO_PREDETERMINADA } from '@/state/useConfiguracion'

export default function useAlertaVencimientoLote() {
  const orgId = useAutenticacion(s => s.usuario?.orgId)
  const usuarioId = useAutenticacion(s => s.usuario?.id)
  const configurado = useConfiguracion(s => s.config?.orgId === orgId && orgId ? s.config.alertaVencimientoDias : undefined)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (!orgId || !usuarioId) return
    const controlador = new AbortController()
    const { signal } = controlador
    obtenerAlertaVencimiento(orgId, signal).then(
      dias => { if (!signal.aborted) setResultado({ orgId, usuarioId, dias: dias ?? ALERTA_VENCIMIENTO_PREDETERMINADA }) },
      () => { if (!signal.aborted) setResultado({ orgId, usuarioId, error: true }) },
    )
    return () => controlador.abort()
  }, [orgId, usuarioId, configurado])

  const actual = resultado?.orgId === orgId && resultado?.usuarioId === usuarioId ? resultado : null
  return { alertaDias: configurado ?? actual?.dias, errorAlerta: configurado == null && actual?.error }
}
