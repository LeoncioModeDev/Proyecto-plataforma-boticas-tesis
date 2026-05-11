import FormularioProveedor from '../common/FormularioProveedor'
import { useNavigate } from 'react-router-dom'

export default function PaginaNuevoProveedor() {
  const navegar = useNavigate()

  const alGuardar = (datos) => {
    console.log('[Mock] Proveedor creado:', datos)
    navegar('/central/proveedores')
  }

  return <FormularioProveedor alGuardar={alGuardar} />
}