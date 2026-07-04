import { useEffect, useState } from 'react'
import Insignia from '@/components/common/Insignia'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import useAlertas from '@/state/useAlertas'
import { ETIQUETAS_ALERTA, COLORES_ALERTA } from '@/constants/tiposAlerta'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { AlertTriangle, TrendingUp, Clock, BrainCircuit, Loader2 } from 'lucide-react'
import { evaluarAlertas, resolverAlertaML } from '@/services/ml-model/alertasML'

const ICONOS = { quiebre: AlertTriangle, sobrestock: TrendingUp, vencimiento: Clock, prediccion: BrainCircuit }

export default function PaginaAlertas() {
  const { alertas, cargando, error, cargarAlertas } = useAlertas()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  const alertasReglas = alertas.filter(a => a.tipoOrigen === 'regla')
  const alertasPredictivas = alertas.filter(a => a.tipoOrigen === 'modelo')

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

  const renderAlerta = (alerta) => {
    const Icono = ICONOS[alerta.tipo] || AlertTriangle
    const resolver = async () => {
      const comentario = window.prompt('Comentario de resolución', '')
      if (comentario === null) return
      setProcesando(true)
      try {
        await resolverAlertaML(alerta.id, comentario)
        await cargarAlertas()
        setMensaje('Alerta resuelta correctamente')
      } catch (err) {
        setMensaje(err.message)
      } finally {
        setProcesando(false)
      }
    }
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
          <div className="text-xs text-secundario mt-1 space-y-1">
            <p>{formatearFechaRelativa(alerta.fechaCreacion)}</p>
            {alerta.referenciaTipo && <p>Origen: {alerta.referenciaTipo} {alerta.referenciaId || ''}</p>}
            {alerta.stockProyectado != null && <p>Stock proyectado: {Number(alerta.stockProyectado).toFixed(2)}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {alerta.referenciaTipo === 'recomendaciones_ml' && alerta.referenciaId && <a className="text-xs text-marca-principal hover:underline" href="/ml/recomendaciones">Ir a recomendación</a>}
            {alerta.productoId && <a className="text-xs text-marca-principal hover:underline" href="/central/inventario/catalogo">Ir a producto</a>}
            <button type="button" onClick={resolver} disabled={procesando} className="text-xs text-estado-exito hover:underline disabled:opacity-60">Marcar resuelta</button>
          </div>
        </div>
      </div>
    )
  }

  const evaluarAhora = async () => {
    setProcesando(true)
    setMensaje(null)
    try {
      const resultado = await evaluarAlertas()
      await cargarAlertas()
      setMensaje(`Evaluación completada: ${resultado?.alertas_evaluadas ?? 0} condición(es) revisadas`)
    } catch (err) {
      setMensaje(err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Alertas Inteligentes</h1>
        <Boton onClick={evaluarAhora} cargando={procesando}>Evaluar alertas ahora</Boton>
      </div>
      {mensaje && <Alerta tipo="exito" titulo={mensaje} alCerrar={() => setMensaje(null)} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas por Reglas ({alertasReglas.length})</h2>
          {alertasReglas.length === 0 && <p className="text-secundario text-sm">Sin alertas por reglas</p>}
          {alertasReglas.map(renderAlerta)}
        </div>
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas Predictivas ({alertasPredictivas.length})</h2>
          {alertasPredictivas.length === 0 && <p className="text-secundario text-sm">Sin alertas predictivas</p>}
          {alertasPredictivas.map(renderAlerta)}
        </div>
      </div>
    </div>
  )
}
