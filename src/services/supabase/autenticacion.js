import { supabase } from './cliente'

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

export async function iniciarSesion(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { usuario: null, error }

  const perfil = await obtenerPerfil(data.user)
  if (perfil && !perfil.activo) {
    await supabase.auth.signOut()
    return { usuario: null, error: { message: 'Usuario desactivado. Contacta al administrador.' } }
  }

  supabase
    .from('usuarios')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', data.user.id)
    .then()
    .catch(() => {})

  return { usuario: mapearUsuario(data.user, perfil), error: null }
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return { sesion: null, error }

  const perfil = await obtenerPerfil(data.session.user)
  if (perfil && !perfil.activo) {
    await supabase.auth.signOut()
    return { sesion: null, error: { message: 'Usuario desactivado.' } }
  }
  return { sesion: { usuario: mapearUsuario(data.session.user, perfil) }, error: null }
}
