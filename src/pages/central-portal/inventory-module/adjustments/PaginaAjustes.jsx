import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import { obtenerAjustesYMermas } from '@/services/supabase/ajustes'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO, ETIQUETAS_DIRECCION, COLORES_DIRECCION } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import useAutenticacion from '@/state/useAutenticacion'

export default function PaginaAjustes() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerAjustesYMermas({ orgId: usuario?.orgId })
      .then(setDatos)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [usuario?.orgId])

  const columnas = [
    { campo: 'id', encabezado: 'ID', render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}...</span> },
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.createdAt) },
    {
      campo: 'tipo',
      encabezado: 'Tipo',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia>
          {r.direccionAjuste && (
            <Insignia color={COLORES_DIRECCION[r.direccionAjuste]}>
              {ETIQUETAS_DIRECCION[r.direccionAjuste]}
            </Insignia>
          )}
        </div>
      ),
    },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    {
      campo: 'motivo',
      encabezado: 'Motivo',
      render: (r) => <span className="text-etiqueta text-secundario max-w-[250px] line-clamp-2">{r.motivo}</span>,
    },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando ajustes y mermas...</p></div>

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-h1 text-principal">Ajustes y Mermas</h1>
        </div>
        <div className="bg-estado-error/10 border border-estado-error/30 rounded-lg p-4 text-estado-error">
          Error al cargar datos: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-principal">Ajustes y Mermas</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/ajustes/nuevo')}>
          Nuevo ajuste
        </Boton>
      </div>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
