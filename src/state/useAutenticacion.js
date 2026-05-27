import { create } from 'zustand'
import { usuarios } from '@/mock-data/usuarios'

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
    // Simular latencia mínima de red
    await new Promise((r) => setTimeout(r, 400))

    const usuario = usuarios.find(
      (u) => u.email === email && password === 'test123'
    )

    if (!usuario) {
      return { error: { message: 'Invalid login credentials' } }
    }
    if (!usuario.activo) {
      return { error: { message: 'Usuario desactivado' } }
    }

    const datos = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      avatar: usuario.avatar || null,
      telefono: usuario.telefono || null,
      orgId: null,
      boticaId: usuario.boticaId || null,
    }

    guardarSesion(datos)
    set({ usuario: datos, autenticado: true })
    return { error: null }
  },

  cerrarSesion: async () => {
    limpiarSesion()
    set({ usuario: null, autenticado: false })
  },

  inicializar: () => {
    const usuario = sesionGuardada()
    set({ usuario, autenticado: !!usuario, cargando: false })
  },
}))

export default useAutenticacion
