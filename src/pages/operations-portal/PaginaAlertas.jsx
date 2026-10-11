import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, Info, Eye, CheckCheck, Loader2 } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import useAlertas from '@/state/useAlertas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const COLORES_URGENCIA = { alta: 'rojo', media: 'amarillo', baja: 'gris' }

export default function PaginaAlertas() {
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [leidas, setLeidas] = useState({})
  const { alertas, cargando, error, cargarAlertas } = useAlertas()

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  let datos = [...alertas].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
  if (filtroUrgencia) datos = datos.filter(a => a.urgencia === filtroUrgencia)

  const marcarLeida = (id) => setLeidas(prev => ({ ...prev, [id]: true }))

  const noLeidas = datos.filter(a => !leidas[a.id]).length

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Alertas de Inventario</h1>
          <p className="text-secundario mt-1">Alertas operativas de toda la red de boticas</p>
        </div>
        {noLeidas > 0 && (
          <button onClick={() => setLeidas(datos.reduce((acc, a) => ({ ...acc, [a.id]: true }), {}))} className="flex items-center gap-1 text-sm text-marca-principal hover:underline">
            <CheckCheck className="h-4 w-4" />Marcar todas leídas
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaMetrica etiqueta="No Leídas" valor={noLeidas} icono={Bell} />
        <TarjetaMetrica etiqueta="Alta Urgencia" valor={datos.filter(a => a.urgencia === 'alta').length} icono={AlertTriangle} />
      </div>

      <div className="flex gap-4">
        <select value={filtroUrgencia} onChange={e => setFiltroUrgencia(e.target.value)} className="w-full sm:w-auto px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todas las urgencias</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      <div className="space-y-4">
        {datos.length === 0 ? (
          <p className="text-secundario">Sin alertas registradas</p>
        ) : (
          datos.map(a => (
            <div
              key={a.id}
              onClick={() => marcarLeida(a.id)}
              className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                leidas[a.id] ? 'bg-fondo border-estilo opacity-70' : 'bg-fondo-secundario border-estilo hover:border-marca-principal'
              }`}
            >
              <div className={`p-2 rounded-full ${a.urgencia === 'alta' ? 'bg-estado-critico-fondo' : 'bg-fondo'}`}>
                {a.tipo === 'quiebre' ? <AlertTriangle className="h-5 w-5 text-estado-critico" /> :
                 a.tipo === 'vencimiento' ? <Info className="h-5 w-5 text-secundario" /> :
                 <Eye className="h-5 w-5 text-secundario" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-cuerpo text-principal">{a.mensaje}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <Insignia color={COLORES_URGENCIA[a.urgencia]}>{a.urgencia}</Insignia>
                  <span className="text-etiqueta text-secundario">{formatearFechaRelativa(a.fechaCreacion)}</span>
                  {a.boticaId && <span className="text-etiqueta text-secundario">Botica: {a.boticaId}</span>}
                </div>
              </div>
              {leidas[a.id] && <CheckCheck className="h-4 w-4 text-marca-principal shrink-0" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
