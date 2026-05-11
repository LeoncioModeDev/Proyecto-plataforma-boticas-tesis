import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useBarraLateral = create(
  persist(
    (set) => ({
      colapsada: false,
      
      setColapsada: (colapsada) => set({ colapsada }),
      
      alternar: () => set((state) => ({ colapsada: !state.colapsada })),
    }),
    {
      name: 'botica-barra-lateral-storage',
    }
  )
)

export default useBarraLateral