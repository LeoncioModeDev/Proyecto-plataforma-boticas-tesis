import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '@/constants/roles'
import useAutenticacion from '@/state/useAutenticacion'
import PanelOrdenesCompra from '@/components/suppliers/PanelOrdenesCompra'
import { ordenesCompra as ordenesMock } from '@/mock-data/ordenesCompra'

export default function PaginaOrdenesCompra() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [ordenes, setOrdenes] = useState(ordenesMock)
  const esAdmin = usuario?.rol === ROLES.ADMIN_CENTRAL

  return (
    <PanelOrdenesCompra
      ordenes={ordenes}
      setOrdenes={setOrdenes}
      esAdmin={esAdmin}
      onNueva={() => navegar('/central/proveedores/ordenes/nueva')}
    />
  )
}
