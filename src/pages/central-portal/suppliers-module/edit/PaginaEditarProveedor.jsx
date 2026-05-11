import { useParams, useNavigate } from 'react-router-dom'
import FormularioProveedor from '../common/FormularioProveedor'
import { useMemo } from 'react'
import Tarjeta from '@/components/common/Tarjeta'
import { proveedores } from '@/mock-data/proveedores'

export default function PaginaEditarProveedor() {
  const { id } = useParams()
  const navegar = useNavigate()

  const proveedor = useMemo(() => proveedores.find(p => p.id === id), [id])

  const alGuardar = (datos) => {
    console.log('[Mock] Proveedor actualizado:', datos)
    navegar('/central/proveedores')
  }

  if (!proveedor) {
    return (
      <Tarjeta>
        <p className="text-cuerpo text-secundario text-center py-8">Proveedor no encontrado</p>
      </Tarjeta>
    )
  }

  return <FormularioProveedor proveedorEditar={proveedor} alGuardar={alGuardar} />
}