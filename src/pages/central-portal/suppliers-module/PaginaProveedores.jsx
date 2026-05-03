import { Users } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'

export default function PaginaProveedores() {
  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-neutro-negro">Proveedores</h1>
      <Tarjeta>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-neutro-gris-borde mb-4" />
          <h3 className="text-h3 text-neutro-negro mb-2">Módulo en Desarrollo</h3>
          <p className="text-cuerpo text-neutro-gris-texto">Este módulo estará disponible en el próximo sprint.</p>
        </div>
      </Tarjeta>
    </div>
  )
}
