import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useTema = create(
  persist(
    (set) => ({
      tema: 'claro',
      pantallaCompleta: false,
      
      cambiarTema: () => set((state) => ({
        tema: state.tema === 'claro' ? 'oscuro' : 'claro'
      })),
      
      establecerTema: (tema) => set({ tema }),
      
      activarPantallaCompleta: () => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen()
        }
        set({ pantallaCompleta: true })
      },
      
      desactivarPantallaCompleta: () => {
        if (document.exitFullscreen) {
          document.exitFullscreen()
        }
        set({ pantallaCompleta: false })
      },
      
      alternarPantallaCompleta: () => set((state) => ({
        pantallaCompleta: !state.pantallaCompleta
      })),
    }),
    {
      name: 'botica-tema-storage',
    }
  )
)

export default useTema