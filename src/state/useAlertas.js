import { create } from 'zustand'
import { obtenerAlertas } from '@/services/supabase/alertas'

function componerMensaje(alerta) {
  const nombre = alerta.nombreProducto
  const botica = alerta.nombreBotica
  switch (alerta.tipo) {
    case 'quiebre': return `${nombre} sin stock en ${botica}`
    case 'vencimiento': return `${nombre} próximo a vencer en ${botica}`
    case 'sobrestock': return `${nombre} con sobrestock en ${botica}`
    case 'prediccion': return `Predicción: ${nombre} en ${botica}`
    default: return `Alerta de ${nombre} en ${botica}`
  }
}

const useAlertas = create((set, get) => ({
  alertas: [],
  cargando: false,
  error: null,

  cargarAlertas: async () => {
    set({ cargando: true, error: null })
    try {
      const datos = await obtenerAlertas({ soloNoResueltas: true })
      const mapeadas = datos.map(a => ({
        id: a.id,
        tipo: a.tipo,
        tipoOrigen: a.tipoOrigen,
        productoId: a.productoId,
        boticaId: a.boticaId,
        urgencia: a.urgencia,
        resuelta: a.resuelta,
        fechaCreacion: a.generadoEn,
        mensaje: componerMensaje(a),
        leida: false,
      }))
      set({ alertas: mapeadas, cargando: false })
    } catch (err) {
      set({ alertas: [], cargando: false, error: err.message })
    }
  },

  obtenerNoLeidas: () => get().alertas.filter(a => !a.leida),
  obtenerContadorNoLeidas: () => get().alertas.filter(a => !a.leida).length,

  marcarComoLeida: (id) => set((estado) => ({
    alertas: estado.alertas.map(a => a.id === id ? { ...a, leida: true } : a),
  })),

  marcarTodasComoLeidas: () => set((estado) => ({
    alertas: estado.alertas.map(a => ({ ...a, leida: true })),
  })),
}))

export default useAlertas
