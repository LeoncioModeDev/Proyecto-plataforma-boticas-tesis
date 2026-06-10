import { create } from 'zustand'
import { iniciarSesion as authLogin, cerrarSesion as authLogout, obtenerSesion } from '@/services/supabase/autenticacion'

const SESION_KEY = 'botica_session'

function sesionGuardada() {
  try {
    const raw = localStorage.getItem(SESION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function guardarSesion(usuario) {
  localStorage.setItem(SESION_KEY, JSON.stringify(usuario))
}

function limpiarSesion() {
  localStorage.removeItem(SESION_KEY)
}

const useAutenticacion = create((set) => ({
  usuario: sesionGuardada(),
  autenticado: !!sesionGuardada(),
  cargando: false,

  iniciarSesion: async (email, password) => {
    set({ cargando: true })
    const { usuario, error } = await authLogin(email, password)
    if (error) {
      set({ cargando: false })
      return { error }
    }
    guardarSesion(usuario)
    set({ usuario, autenticado: true, cargando: false })
    return { error: null }
  },

  cerrarSesion: async () => {
    await authLogout()
    limpiarSesion()
    set({ usuario: null, autenticado: false })
  },

  inicializar: async () => {
    set({ cargando: true })
    const { sesion, error } = await obtenerSesion()
    if (!error && sesion?.usuario) {
      guardarSesion(sesion.usuario)
      set({ usuario: sesion.usuario, autenticado: true, cargando: false })
    } else {
      limpiarSesion()
      set({ usuario: null, autenticado: false, cargando: false })
    }
  },
}))

export default useAutenticacion
