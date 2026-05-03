import { usuarios } from '@/mock-data/usuarios'

const LATENCIA = 300

export async function iniciarSesion(email, password) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const usuario = usuarios.find(u => u.email === email)
  if (usuario) return { usuario, error: null }
  // En modo mock, cualquier combinación funciona con el primer usuario
  return { usuario: usuarios[0], error: null }
}

export async function cerrarSesion() {
  await new Promise(r => setTimeout(r, LATENCIA))
  console.log('[Mock] Sesión cerrada')
  return { error: null }
}

export async function obtenerUsuarioActual() {
  await new Promise(r => setTimeout(r, LATENCIA))
  return null // Sin sesión persistida en modo mock
}
