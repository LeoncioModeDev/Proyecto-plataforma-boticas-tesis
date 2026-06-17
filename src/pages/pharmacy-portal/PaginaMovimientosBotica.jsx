import { useState, useEffect } from 'react'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaMovimientosBotica() {
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    obtenerMovimientos()
      .then(data => {
        setDatos(filtrarPorBotica(usuario, data, 'ubicacionId').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const columnas = [
    { campo: 'createdAt', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.createdAt) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-secundario line-clamp-1">{r.motivo}</span> },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando movimientos...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Movimientos de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
