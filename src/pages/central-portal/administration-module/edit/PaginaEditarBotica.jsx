import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import FormularioBotica from '../common/FormularioBotica'
import Tarjeta from '@/components/common/Tarjeta'
import { boticas } from '@/mock-data/boticas'

export default function PaginaEditarBotica() {
  const { id } = useParams()
  const navegar = useNavigate()

  const botica = useMemo(() => boticas.find(b => b.id === id), [id])

  const alGuardar = (datos) => {
    console.log('[Mock] Botica actualizada:', datos)
    navegar('/central/administracion/boticas')
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
