import { useEffect } from 'react'
import useTema from '@/state/useTema'

export default function ProveedorTema({ children }) {
  const tema = useTema(s => s.tema)
  
  useEffect(() => {
    if (tema === 'oscuro') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [tema])

  return children
}