import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FormularioProveedor from '../common/FormularioProveedor'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { obtenerProveedor, actualizarProveedor } from '@/services/supabase/proveedores'

export default function PaginaEditarProveedor() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [proveedor, setProveedor] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        setError(null)
        const datos = await obtenerProveedor(id)
        if (!datos) throw new Error('Proveedor no encontrado')
        setProveedor(datos)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  const alGuardar = async (datos) => {
    try {
      setGuardando(true)
      setError(null)
      await actualizarProveedor(id, datos)
      navegar('/central/proveedores')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <Tarjeta><p className="text-cuerpo text-secundario text-center py-8">Cargando proveedor...</p></Tarjeta>
  }

  if (error) {
    return (
      <Tarjeta>
        <Alerta tipo="error" titulo={error} />
        <p className="text-cuerpo text-secundario text-center py-8">Proveedor no encontrado</p>
      </Tarjeta>
    )
  }

  return <FormularioProveedor proveedorEditar={proveedor} alGuardar={alGuardar} />
}
