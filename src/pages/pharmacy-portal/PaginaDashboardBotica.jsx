import { useState, useEffect } from 'react'
import { Boxes, CalendarClock, AlertTriangle, ArrowLeftRight, Truck } from 'lucide-react'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerLotesActivos, obtenerLotesProximosAVencer } from '@/services/supabase/lotes'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { obtenerProductos } from '@/services/supabase/productos'
import { listarBoticas } from '@/services/supabase/boticas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { ESTADOS_TRANSFERENCIA, ETIQUETAS_TRANSFERENCIA, COLORES_TRANSFERENCIA } from '@/constants/transferencias'

const MAPEO_COLORES = {
  amarillo: 'amarillo',
  azul: 'azul',
  verde: 'verde',
  rojo: 'rojo',
  naranja: 'naranja',
}

export default function PaginaDashboardBotica() {
  const { usuario } = useAutenticacion()
  const boticaId = usuario?.boticaId || usuario?.orgId

  const [stock, setStock] = useState([])
  const [lotes, setLotes] = useState([])
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [boticas, setBoticas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      obtenerStockPorUbicacion(boticaId),
      obtenerLotesActivos(undefined, undefined, boticaId),
      obtenerProductos({ activos: true }),
      obtenerMovimientos({ ubicacionId: boticaId }),
      obtenerTransferencias(),
      listarBoticas({ activas: true }),
    ]).then(([stockData, lotesData, prodData, movData, transData, botData]) => {
      setStock(stockData)
      setLotes(lotesData)
      setProductos(prodData)
      setMovimientos(movData)
      setTransferencias(transData)
      setBoticas(botData)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [boticaId])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando dashboard...</p></div>
  }

  const botica = boticas.find(b => b.id === boticaId)
  const stockTotal = stock.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const bajoMinimo = stock.filter(s => s.cantidadDisponible < s.stockMinimo).length
  const lotesPorVencer = lotes.filter(l => {
    const dias = (new Date(l.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
    return dias < 90
  }).length
  const transferenciasRecibidas = transferencias
    .filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECIBIDA && t.destinoId === boticaId)
    .slice(0, 5)

  const movimientosRecientes = movimientos
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">{botica?.nombre || 'Mi Botica'}</h1>
        <p className="text-secundario mt-1">Panel de gestión local</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Stock Actual" valor={stockTotal} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Bajo Mínimo" valor={bajoMinimo} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Próximos a Vencer" valor={lotesPorVencer} icono={CalendarClock} />
        <TarjetaMetrica etiqueta="Transferencias Recibidas" valor={transferencias.filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECIBIDA && t.destinoId === boticaId).length} icono={Truck} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Últimas Transferencias Recibidas">
          {transferenciasRecibidas.length === 0 ? (
            <p className="text-secundario text-sm text-center py-4">Sin transferencias recibidas</p>
          ) : (
            <div className="space-y-3">
              {transferenciasRecibidas.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-fondo rounded-md">
                  <div>
                    <p className="text-cuerpo text-principal">{t.origen?.nombre || 'Droguería Central'}</p>
                    <p className="text-etiqueta text-secundario">{t.items?.length || 0} productos</p>
                  </div>
                  <span className="text-etiqueta text-secundario">{formatearFechaRelativa(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Movimientos Recientes">
          {movimientosRecientes.length === 0 ? (
            <p className="text-secundario text-sm text-center py-4">Sin movimientos recientes</p>
          ) : (
            <div className="divide-y divide-estilo">
              {movimientosRecientes.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-secundario" />
                    <span className="text-cuerpo text-principal">{m.nombreProducto}</span>
                  </div>
                  <span className="text-etiqueta text-secundario">{formatearFechaRelativa(m.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Resumen de Stock">
        <div className="overflow-x-auto">
          <table className="w-full text-cuerpo">
            <thead>
              <tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                <th className="pb-2">Producto</th>
                <th className="pb-2 text-right">Disponible</th>
                <th className="pb-2 text-right">Mínimo</th>
                <th className="pb-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stock.slice(0, 8).map(s => (
                <tr key={s.id} className="border-b border-estilo last:border-0">
                  <td className="py-2.5">{s.nombreProducto}</td>
                  <td className="py-2.5 text-right font-semibold">{s.cantidadDisponible}</td>
                  <td className="py-2.5 text-right text-secundario">{s.stockMinimo}</td>
                  <td className="py-2.5 text-right">
                    <Insignia color={s.cantidadDisponible < s.stockMinimo ? 'rojo' : s.cantidadDisponible === 0 ? 'gris' : 'verde'}>
                      {s.cantidadDisponible === 0 ? 'Sin stock' : s.cantidadDisponible < s.stockMinimo ? 'Bajo' : 'Normal'}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
