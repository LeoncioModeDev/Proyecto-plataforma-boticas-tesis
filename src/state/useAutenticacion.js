import { create } from 'zustand'
import { supabase } from '@/services/supabase/cliente'

function mapearUsuario(user, perfil) {
  if (perfil) {
    return {
      id: perfil.id,
      email: perfil.email,
      nombre: perfil.nombre,
      rol: perfil.rol,
      avatar: perfil.avatar,
      telefono: perfil.telefono,
      orgId: perfil.org_id,
      boticaId: perfil.botica_id,
    }
  }
  return {
    id: user.id,
    email: user.email,
    nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
    rol: user.user_metadata?.rol || 'visor_botica',
    avatar: user.user_metadata?.avatar || null,
    telefono: user.user_metadata?.telefono || null,
    orgId: user.user_metadata?.org_id || null,
    boticaId: user.user_metadata?.botica_id || null,
  }
}

async function obtenerPerfil(user) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error || !data) return null
  return data
}

const useAutenticacion = create((set) => ({
  usuario: null,
  autenticado: false,
  cargando: true,

  iniciarSesion: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    const perfil = await obtenerPerfil(data.user)
    set({ usuario: mapearUsuario(data.user, perfil), autenticado: true })
    return { error: null }
  },

  cerrarSesion: async () => {
    await supabase.auth.signOut()
    set({ usuario: null, autenticado: false })
  },

  inicializar: () => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const perfil = await obtenerPerfil(session.user)
        set({ usuario: mapearUsuario(session.user, perfil), autenticado: true, cargando: false })
      } else {
        set({ cargando: false })
      }
    })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const perfil = await obtenerPerfil(session.user)
        set({ usuario: mapearUsuario(session.user, perfil), autenticado: true })
      } else {
        set({ usuario: null, autenticado: false })
      }
    })
  },
}))

export default useAutenticacion
