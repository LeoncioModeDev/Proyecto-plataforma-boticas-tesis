import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '@/constants/roles'
import useAutenticacion from '@/state/useAutenticacion'
import PanelOrdenesCompra from '@/components/suppliers/PanelOrdenesCompra'
import { listarOrdenes } from '@/services/supabase/ordenesCompra'

export default function PaginaOrdenesCompra() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const esAdmin = usuario?.rol === ROLES.ADMIN_CENTRAL

  const cargar = async () => {
    try {
      const data = await listarOrdenes()
      setOrdenes(data)
    } catch (e) {
      console.error('Error cargando órdenes:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secundario">Cargando órdenes de compra...</p>
      </div>
    )
  }

  return (
    <div>
      <PanelOrdenesCompra
        ordenes={ordenes}
        esAdmin={esAdmin}
        onNueva={() => navegar('/operaciones/ordenes-compra/nueva')}
        onActualizar={cargar}
        rutaBase="/operaciones/ordenes-compra"
      />
    </div>
  )
}
