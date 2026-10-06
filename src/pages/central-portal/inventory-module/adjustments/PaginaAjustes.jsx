import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Modal from '@/components/common/Modal'

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
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerAjustesYMermas({ orgId: usuario?.orgId })
      .then(setDatos)
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [usuario?.orgId])

  const columnas = [
    { campo: 'codigoProducto', encabezado: 'Código', render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: 'createdAt', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.createdAt) },
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
      render: (r) => <span className="block text-etiqueta text-secundario max-w-[250px] truncate">{r.motivo}</span>,
    },
  ]

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando ajustes y mermas...</p></div>

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1 text-principal">Ajustes y Mermas</h1>
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/inventario/ajustes/nuevo')}>
          Nuevo ajuste
        </Boton>
      </div>
      <Tabla columnas={columnas} datos={datos} alClickFila={setDetalle} />
      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de ajuste o merma" tamano="lg">
        {detalle && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><p className="text-etiqueta text-secundario">Producto</p><p className="font-medium text-principal">{detalle.nombreProducto}</p></div>
            <div><p className="text-etiqueta text-secundario">Código</p><p className="font-mono text-principal">{detalle.codigoProducto || '-'}</p></div>
            <div><p className="text-etiqueta text-secundario">Ubicación</p><p className="font-medium text-principal">{detalle.nombreUbicacion}</p></div>
            <div><p className="text-etiqueta text-secundario">Fecha/hora</p><p className="font-medium text-principal">{formatearFechaHora(detalle.createdAt)}</p></div>
            <div><p className="text-etiqueta text-secundario">Tipo</p><div className="flex gap-1.5"><Insignia color={COLORES_MOVIMIENTO[detalle.tipo]}>{ETIQUETAS_MOVIMIENTO[detalle.tipo]}</Insignia>{detalle.direccionAjuste && <Insignia color={COLORES_DIRECCION[detalle.direccionAjuste]}>{ETIQUETAS_DIRECCION[detalle.direccionAjuste]}</Insignia>}</div></div>
            <div><p className="text-etiqueta text-secundario">Cantidad</p><p className="font-medium text-principal">{detalle.cantidad}</p></div>
            <div className="sm:col-span-2"><p className="text-etiqueta text-secundario">Motivo</p><p className="font-medium text-principal whitespace-pre-wrap">{detalle.motivo || '-'}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
