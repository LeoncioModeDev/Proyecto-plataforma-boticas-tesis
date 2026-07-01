import { useEffect, useState } from 'react'
import { AlertTriangle, BrainCircuit, Loader2 } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

export default function PaginaAlertasDemanda() {
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const datos = await obtenerPredicciones({ limit: 100 })
        const bajasConfianza = datos
          .filter(p => p.confianza !== null && p.confianza < 0.8)
          .map(p => ({
            id: p.id,
            producto: p.productoId,
            botica: p.boticaId,
            confianza: p.confianza,
            metodo: p.metodoAplicado,
            fecha: p.generadoEn,
          }))
        if (activo) setAlertas(bajasConfianza)
      } catch (err) {
        if (activo) setError(err.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [])

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
        <p className="text-cuerpo text-estado-critico">Error al cargar alertas de demanda</p>
        <p className="text-sm text-secundario mt-1">{error}</p>
      </div>
    )
  }

  const alertasAltas = alertas.filter(a => a.confianza < 0.7).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Alertas de Demanda</h1>
        <p className="text-secundario mt-1">Alertas generadas por el modelo ML sobre patrones de demanda</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="Alertas Activas" valor={alertas.length} icono={BrainCircuit} />
        <TarjetaMetrica etiqueta="Alta Dispersión" valor={alertasAltas} icono={AlertTriangle} />
      </div>

      <div className="space-y-4">
        {alertas.length === 0 ? (
          <p className="text-secundario">No hay alertas de demanda activas</p>
        ) : (
          alertas.map(a => (
            <div key={a.id} className="flex items-start gap-4 p-4 bg-fondo-secundario border border-estilo rounded-lg">
              <div className="p-2 bg-marca-claro rounded-full">
                <BrainCircuit className="h-5 w-5 text-marca-principal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-cuerpo text-principal font-medium">{a.producto}</p>
                <p className="text-etiqueta text-secundario">{a.botica}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Insignia color={a.confianza < 0.7 ? 'rojo' : a.confianza < 0.8 ? 'amarillo' : 'verde'}>
                    Confianza: {(a.confianza * 100).toFixed(0)}%
                  </Insignia>
                  <Insignia color="azul">{a.metodo || 'ML'}</Insignia>
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
