import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FormularioBotica from '../common/FormularioBotica'
import Cargando from '@/components/common/Cargando'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { obtenerBotica } from '@/services/supabase/boticas'

export default function PaginaEditarBotica() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [botica, setBotica] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerBotica(id)
      .then(setBotica)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [id])

  const alGuardar = () => {
    navegar('/central/administracion/boticas')
  }

  if (cargando) {
    return (
      <div className="space-y-6">
        <Cargando />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alerta tipo="error" titulo={error} />
      </div>
    )
  }

  if (!botica) {
    return (
      <Tarjeta>
        <p className="text-cuerpo text-secundario text-center py-8">Botica no encontrada</p>
      </Tarjeta>
    )
  }

  return <FormularioBotica boticaEditar={botica} alGuardar={alGuardar} />
}
