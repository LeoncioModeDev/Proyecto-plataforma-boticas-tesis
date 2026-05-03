import { create } from 'zustand'
import { alertas as alertasMock } from '@/datos-prueba/alertas'

/**
 * Store de alertas globales.
 * Mantiene lista de alertas y contador de no leídas.
 */
const useAlertas = create((set, get) => ({
  alertas: alertasMock,

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
