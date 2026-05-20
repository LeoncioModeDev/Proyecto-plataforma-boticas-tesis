import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import { movimientos } from '@/mock-data/movimientos'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { usuarios } from '@/mock-data/usuarios'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO, OPCIONES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'

export default function PaginaMovimientos() {
  const navegar = useNavigate()
  const [filtroTipo, setFiltroTipo] = useState('')
  const obtenerNombre = (id, lista, campo) => lista.find(i => i.id === id)?.[campo] || id
  let filtrados = [...movimientos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  if (filtroTipo) filtrados = filtrados.filter(m => m.tipo === filtroTipo)

  const columnas = [
    { campo: 'createdAt', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => obtenerNombre(r.productoId, productos, 'nombreComercial') },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => <span className={r.tipo === 'entrada' || r.tipo === 'ajuste' ? 'text-marca-principal font-semibold' : 'text-estado-critico font-semibold'}>{r.tipo === 'entrada' ? '+' : '-'}{Math.abs(r.cantidad)}</span> },
    { campo: 'ubicacionId', encabezado: 'Ubicación', render: (r) => obtenerNombre(r.ubicacionId, boticas, 'nombre') },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-neutro-gris-texto line-clamp-1 max-w-[200px]">{r.motivo}</span> },
    { campo: 'usuarioId', encabezado: 'Usuario', render: (r) => obtenerNombre(r.usuarioId, usuarios, 'nombre') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Movimientos de Inventario</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/movimientos/nuevo')}>Registrar movimiento</Boton>
      </div>
      <div className="flex gap-4">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los tipos</option>
          {OPCIONES_MOVIMIENTO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtrados} />
    </div>
  )
}
