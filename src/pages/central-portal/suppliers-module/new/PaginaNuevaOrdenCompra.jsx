import FormularioOrdenCompra from '@/components/suppliers/FormularioOrdenCompra'
import { crearOrden } from '@/services/supabase/ordenesCompra'

export default function PaginaNuevaOrdenCompra() {
  const handleGuardar = async (orden) => {
    return crearOrden(orden)
  }

  return (
    <FormularioOrdenCompra
      onGuardar={handleGuardar}
      redirectPath="/central/proveedores/ordenes"
    />
  )
}
