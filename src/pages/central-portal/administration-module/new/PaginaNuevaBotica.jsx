import { useNavigate } from 'react-router-dom'
import FormularioBotica from '../common/FormularioBotica'

export default function PaginaNuevaBotica() {
  const navegar = useNavigate()

  const alGuardar = (datos) => {
    console.log('[Mock] Botica creada:', datos)
    navegar('/central/administracion/boticas')
  }

  return <FormularioBotica alGuardar={alGuardar} />
}
