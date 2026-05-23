import { Boxes, CalendarClock, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { stock } from '@/mock-data/stock'
import { lotes } from '@/mock-data/lotes'
import { movimientos } from '@/mock-data/movimientos'
import { alertas } from '@/mock-data/alertas'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { clasificarAlerta, COLORES_ESTADO_STOCK, ETIQUETAS_ESTADO_STOCK } from '@/utilities/clasificarAlerta'
import { COLORES_ALERTA, ETIQUETAS_ALERTA } from '@/constants/tiposAlerta'
import { obtenerFiltroBotica, filtrarPorBotica, filtrarPorBoticaId } from '@/utilities/permisos'

export default function PaginaDashboardBotica() {
  const { usuario } = useAutenticacion()
  const boticaId = obtenerFiltroBotica(usuario)
  const botica = boticaId ? boticas.find(b => b.id === boticaId) : null

  const stockLocal = filtrarPorBotica(usuario, stock, 'ubicacionId')
  const lotesLocal = filtrarPorBotica(usuario, lotes, 'ubicacionId')
  const alertasLocal = filtrarPorBoticaId(usuario, alertas.filter(a => !a.resuelta), 'boticaId')
  const movimientosRecientes = filtrarPorBotica(usuario, movimientos, 'ubicacionId')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  const totalProductos = stockLocal.length
  const stockTotal = stockLocal.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const lotesPorVencer = lotesLocal.filter(l => {
    const dias = (new Date(l.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)
    return dias < 90
  }).length
  const enAlerta = stockLocal.filter(s => clasificarAlerta(s) === 'critico').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">{botica?.nombre || 'Mi Botica'}</h1>
        <p className="text-secundario mt-1">Panel de gestión local</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Productos" valor={totalProductos} icono={Boxes} />
        <TarjetaMetrica etiqueta="Stock Total" valor={stockTotal} icono={Boxes} />
        <TarjetaMetrica etiqueta="Lotes por Vencer" valor={lotesPorVencer} icono={CalendarClock} />
        <TarjetaMetrica etiqueta="En Alerta" valor={enAlerta} icono={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Alertas Activas">
          {alertasLocal.length === 0 ? (
            <p className="text-secundario">Sin alertas activas</p>
          ) : (
            <div className="space-y-3">
              {alertasLocal.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-fondo rounded-md">
                  <Insignia color={COLORES_ALERTA[a.tipo]}>{ETIQUETAS_ALERTA[a.tipo]}</Insignia>
                  <div className="flex-1 min-w-0">
                    <p className="text-cuerpo text-principal line-clamp-2">{a.mensaje}</p>
                    <p className="text-etiqueta text-secundario mt-1">{formatearFechaRelativa(a.fechaCreacion)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Movimientos Recientes">
          {movimientosRecientes.length === 0 ? (
            <p className="text-secundario">Sin movimientos recientes</p>
          ) : (
            <div className="divide-y divide-estilo">
              {movimientosRecientes.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-secundario" />
                    <span className="text-cuerpo text-principal">{productos.find(p => p.id === m.productoId)?.nombreComercial || m.productoId}</span>
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
              {stockLocal.slice(0, 8).map(s => {
                const alerta = clasificarAlerta(s)
                return (
                  <tr key={s.id} className="border-b border-estilo last:border-0">
                    <td className="py-2.5">{productos.find(p => p.id === s.productoId)?.nombreComercial || s.productoId}</td>
                    <td className="py-2.5 text-right font-semibold">{s.cantidadDisponible}</td>
                    <td className="py-2.5 text-right text-secundario">{s.stockMinimo}</td>
                    <td className="py-2.5 text-right"><Insignia color={COLORES_ESTADO_STOCK[alerta]}>{ETIQUETAS_ESTADO_STOCK[alerta]}</Insignia></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
