import { create } from 'zustand'
import { obtenerConfiguracion, actualizarConfiguracion } from '@/services/supabase/configuracion'

const useConfiguracion = create((set, get) => ({
  config: null,
  cargando: false,
  error: null,
  guardando: false,

  cargarConfig: async () => {
    set({ cargando: true, error: null })
    try {
      const config = await obtenerConfiguracion()
      set({ config, cargando: false })
    } catch (e) {
      set({ error: e.message, cargando: false })
    }
  },

  guardarConfig: async (campos) => {
    set({ guardando: true, error: null })
    try {
      await actualizarConfiguracion(campos)
      const config = await obtenerConfiguracion()
      set({ config, guardando: false })
      return { exito: true }
    } catch (e) {
      set({ error: e.message, guardando: false })
      return { exito: false, error: e.message }
    }
  },

  limpiarError: () => set({ error: null }),

  obtenerDominioCorreo: () => get().config?.dominioCorreoOrganizacion || null,
  obtenerAlertaVencimientoDias: () => get().config?.alertaVencimientoDias ?? 30,
  obtenerUmbralSobrestockDias: () => get().config?.umbralSobrestockDias ?? 60,
  obtenerHorizonteQuiebreDias: () => get().config?.horizonteAlertaQuiebreDias ?? 30,
}))

export default useConfiguracion
