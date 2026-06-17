import { useState, useEffect } from 'react'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { filtrarPorBotica } from '@/utilities/permisos'

export default function PaginaStockBotica() {
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    obtenerStockPorUbicacion()
      .then(data => {
        const filtrados = filtrarPorBotica(usuario, data, 'ubicacionId')
        setDatos(filtrados.map(s => ({ ...s, estadoAlerta: clasificarAlerta(s) })))
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [usuario])

  const columnas = [
    { campo: 'nombreProducto', encabezado: 'Producto' },
    { campo: 'stockDisponible', encabezado: 'Disponible' },
    { campo: 'stockEnTransito', encabezado: 'En Tránsito', render: (r) => (
      <span className={r.stockEnTransito > 0 ? 'text-marca-principal font-medium' : 'text-secundario'}>{r.stockEnTransito ?? 0}</span>
    )},
    { campo: 'stockMinimo', encabezado: 'Mínimo' },
    { campo: 'estadoAlerta', encabezado: 'Estado', render: (r) => <Insignia color={COLORES_ESTADO_STOCK[r.estadoAlerta]}>{ETIQUETAS_ESTADO_STOCK[r.estadoAlerta]}</Insignia> },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando stock...</p></div>
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Stock de mi Botica</h1>
      <Tabla columnas={columnas} datos={datos} />
    </div>
  )
}
