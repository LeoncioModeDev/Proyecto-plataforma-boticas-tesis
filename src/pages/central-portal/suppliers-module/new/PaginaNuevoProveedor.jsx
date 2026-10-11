import { useState } from 'react'
import FormularioProveedor from '../common/FormularioProveedor'
import { useNavigate } from 'react-router-dom'
import { crearProveedor } from '@/services/supabase/proveedores'
import Alerta from '@/components/common/Alerta'

export default function PaginaNuevoProveedor() {
  const navegar = useNavigate()
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const alGuardar = async (datos) => {
    try {
      setCargando(true)
      setError(null)
      await crearProveedor(datos)
      navegar('/central/proveedores')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}
      <FormularioProveedor alGuardar={alGuardar} />
    </>
  )
}
