import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, List, Settings } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import ModalConfigurarStock from '@/pages/central-portal/inventory-module/stock/ModalConfigurarStock'
import { obtenerStockPorId } from '@/services/supabase/stock'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'

function obtenerBaseInventario(pathname) {
  if (pathname.startsWith('/operaciones')) return '/operaciones/inventario'
  if (pathname.startsWith('/botica')) return '/botica'
  return '/central/inventario'
}

export default function DetalleStockActual() {
  const { id } = useParams()
  const location = useLocation()
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [registro, setRegistro] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [configurarStock, setConfigurarStock] = useState(null)

  useEffect(() => {
    obtenerStockPorId(id)
      .then(data => setRegistro({ ...data, estadoAlerta: clasificarAlerta(data) }))
      .catch(err => setError(err.message))
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) return <div className="flex justify-center py-12"><p className="text-secundario">Cargando stock...</p></div>
  if (error || !registro) return <SinDatos titulo="Stock no encontrado" descripcion={error || 'El registro solicitado no existe.'} textoAccion="Volver" alAccionar={() => navegar(-1)} />

  const base = obtenerBaseInventario(location.pathname)
  const qs = new URLSearchParams({ productoId: registro.productoId })
  if (registro.ubicacionId) qs.set('ubicacionId', registro.ubicacionId)
  const puedeConfigurar = usuario?.rol === ROLES.ADMIN_CENTRAL

  const filas = [
    ['Producto', registro.nombreProducto],
    ['Código', registro.codigoProducto || '-'],
    ['Ubicación', registro.nombreUbicacion],
    ['Stock Físico', registro.stockFisico],
    ['Stock Comprometido', registro.stockComprometido],
    ['Stock Disponible', registro.stockDisponible],
    ['Stock por Recibir', registro.stockPorRecibir],
    ['Stock en Tránsito', registro.stockEnTransito],
    ['Stock Mínimo', registro.stockMinimo],
    ['Stock Máximo', registro.stockMaximo ?? '-'],
    ['Últ. Actualización', formatearFechaRelativa(registro.ultimaActualizacion)],
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(-1)}>Volver</Boton>
        <div>
          <h1 className="text-h1 text-principal">{registro.nombreProducto}</h1>
          <p className="text-secundario mt-1">Stock actual en {registro.nombreUbicacion}</p>
        </div>
        <Insignia color={COLORES_ESTADO_STOCK[registro.estadoAlerta]}>{ETIQUETAS_ESTADO_STOCK[registro.estadoAlerta]}</Insignia>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" icono={List} onClick={() => navegar(`${base}/movimientos?${qs.toString()}`)}>Ver movimientos</Boton>
          <Boton variante="secundario" icono={CalendarClock} onClick={() => navegar(`${base}/lotes?${qs.toString()}`)}>Ver lotes</Boton>
          {puedeConfigurar && (
            <Boton variante="primario" icono={Settings} onClick={() => setConfigurarStock(registro)}>Configurar umbrales de stock</Boton>
          )}
        </div>
      </div>

      <Tarjeta titulo="Información de stock">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
          {filas.map(([label, value]) => (
            <div key={label}>
              <p className="text-etiqueta text-secundario">{label}</p>
              <div className="text-cuerpo text-principal mt-0.5 font-medium">{value}</div>
            </div>
          ))}
        </div>
      </Tarjeta>

      <ModalConfigurarStock
        key={configurarStock?.id ?? 'cerrado'}
        abierto={!!configurarStock}
        alCerrar={() => setConfigurarStock(null)}
        producto={configurarStock}
        onActualizarStock={(_, stockMinimo, stockMaximo) => {
          setRegistro(prev => prev ? { ...prev, stockMinimo, stockMaximo, estadoAlerta: clasificarAlerta({ ...prev, stockMinimo, stockMaximo }) } : prev)
        }}
      />
    </div>
  )
}
