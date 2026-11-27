import { supabase } from './cliente'

function mapearUsuario(perfil) {
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
  if (!perfil?.activo) {
    await supabase.auth.signOut({ scope: 'local' })
    return { usuario: null, error: { message: perfil ? 'Usuario desactivado. Contacta al administrador.' : 'No se pudo validar tu perfil.' } }
  }

  supabase
    .from('usuarios')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', data.user.id)
    .then()
    .catch(() => {})

  return { usuario: mapearUsuario(perfil), error: null }
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return { sesion: null, error: error && { message: 'No se pudo verificar tu sesión. Inicia sesión nuevamente.' } }

  const perfil = await obtenerPerfil(data.session.user)
  if (!perfil?.activo) {
    // Un fallo al leer el perfil no equivale a un token inválido.
    return { sesion: null, error: { message: perfil ? 'Usuario desactivado.' : 'No se pudo validar tu perfil.' } }
  }
  return { sesion: { usuario: mapearUsuario(perfil) }, error: null }
}
