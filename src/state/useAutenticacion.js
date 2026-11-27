import { create } from 'zustand'
import { iniciarSesion as authLogin, cerrarSesion as authLogout, obtenerSesion } from '@/services/supabase/autenticacion'
import { supabase } from '@/services/supabase/cliente'

let revision = 0
let cerrandoSesion = false
const SIN_SESION = { usuario: null, autenticado: false, cargando: false }

const useAutenticacion = create((set, get) => ({
  ...SIN_SESION,
  cargando: true,
  avisoSesion: null,

  iniciarSesion: async (email, password) => {
    const actual = ++revision
    set({ cargando: true, avisoSesion: null })
    try {
      const { usuario, error } = await authLogin(email, password)
      if (error) return { error }
      if (actual !== revision) return { error: { message: 'La sesión cambió. Intenta iniciar sesión nuevamente.' } }
      set({ usuario, autenticado: true })
      return { error: null }
    } catch {
      return { error: { message: 'No se pudo iniciar sesión. Intenta nuevamente.' } }
    } finally {
      if (actual === revision) set({ cargando: false })
    }
  },

  cerrarSesion: async () => {
    ++revision
    cerrandoSesion = true
    set({ ...SIN_SESION, avisoSesion: null })
    try {
      const { error } = await authLogout()
      if (error) set({ avisoSesion: 'No se pudo confirmar el cierre de sesión.' })
    } catch {
      set({ avisoSesion: 'No se pudo confirmar el cierre de sesión.' })
    } finally {
      cerrandoSesion = false
    }
  },

  inicializar: async () => {
    const actual = ++revision
    const autenticado = get().autenticado
    set({ cargando: true })
    try {
      const { sesion, error } = await obtenerSesion()
      if (actual !== revision) return
      if (sesion?.usuario) {
        set({ usuario: sesion.usuario, autenticado: true, cargando: false, avisoSesion: null })
      } else {
        set({ ...SIN_SESION, avisoSesion: autenticado && !error ? 'Tu sesión ha expirado. Inicia sesión nuevamente.' : error?.message ?? null })
      }
    } catch {
      if (actual === revision) set({ ...SIN_SESION, avisoSesion: 'No se pudo verificar tu sesión. Intenta nuevamente.' })
    }
  },

  observarSesion: () => {
    let temporizador
    let activa = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (!activa) return
      if (evento === 'SIGNED_OUT') {
        clearTimeout(temporizador)
        ++revision
        const expirada = get().autenticado && !cerrandoSesion
        set({ ...SIN_SESION, ...(expirada && { avisoSesion: 'Tu sesión ha expirado. Inicia sesión nuevamente.' }) })
      } else if (evento === 'SIGNED_IN' && sesion && !get().cargando && !cerrandoSesion && get().usuario?.id !== sesion.user.id) {
        // Supabase no debe recibir llamadas de Auth dentro de su propio callback.
        clearTimeout(temporizador)
        temporizador = setTimeout(() => { if (activa && !cerrandoSesion && !get().cargando) get().inicializar() }, 0)
      }
    })
    return () => {
      activa = false
      clearTimeout(temporizador)
      subscription.unsubscribe()
    }
  },
}))

export default useAutenticacion
