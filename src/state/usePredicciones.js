import { create } from 'zustand'
import { predicciones as prediccionesMock } from '@/mock-data/predicciones'

/**
 * Store de predicciones del modelo ML.
 */
const usePredicciones = create((set) => ({
  predicciones: prediccionesMock,
  prediccionSeleccionada: null,
  cargando: false,

  seleccionarPrediccion: (pred) => set({ prediccionSeleccionada: pred }),

  recargar: () => {
    set({ cargando: true })
    // Simula latencia de recarga
    setTimeout(() => {
      set({ predicciones: prediccionesMock, cargando: false })
    }, 500)
  },
}))

export default usePredicciones
