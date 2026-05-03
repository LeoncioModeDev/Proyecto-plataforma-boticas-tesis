import { create } from 'zustand'
import { usuarios } from '@/mock-data/usuarios'

/**
 * Store de autenticación.
 * En fase mock, simula autenticación seleccionando un usuario de datos de prueba.
 */
const useAutenticacion = create((set) => ({
  usuario: null,
  autenticado: false,

  iniciarSesion: (rol) => {
    const usuarioEncontrado = usuarios.find(u => u.rol === rol) || usuarios[0]
    set({ usuario: usuarioEncontrado, autenticado: true })
  },

  cerrarSesion: () => {
    set({ usuario: null, autenticado: false })
  },

  actualizarUsuario: (datos) => {
    set((estado) => ({
      usuario: { ...estado.usuario, ...datos },
    }))
  },
}))

export default useAutenticacion
