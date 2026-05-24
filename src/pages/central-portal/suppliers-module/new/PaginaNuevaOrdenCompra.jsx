import FormularioOrdenCompra from '@/components/suppliers/FormularioOrdenCompra'
import { ordenesCompra as ordenesMock } from '@/mock-data/ordenesCompra'

let ordenesGlobal = [...ordenesMock]

export default function PaginaNuevaOrdenCompra() {
  const handleGuardar = (nuevaOC) => {
    ordenesGlobal.push(nuevaOC)
  }

  return (
    <FormularioOrdenCompra
      onGuardar={handleGuardar}
      redirectPath="/central/proveedores/ordenes"
    />
  )
}
