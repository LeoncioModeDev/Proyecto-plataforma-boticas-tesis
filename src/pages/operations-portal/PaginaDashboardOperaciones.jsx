import { Package, AlertTriangle, Boxes, Truck, CalendarClock } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Insignia from '@/components/common/Insignia'
import { stock } from '@/mock-data/stock'
import { productos } from '@/mock-data/productos'
import { alertas } from '@/mock-data/alertas'
import { transferencias } from '@/mock-data/transferencias'
import { boticas } from '@/mock-data/boticas'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { clasificarAlerta } from '@/utilities/clasificarAlerta'

export default function PaginaDashboardOperaciones() {
  const stockTotal = stock.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const productosActivos = productos.filter(p => p.estado === 'activo').length
  const alertasCriticas = alertas.filter(a => !a.leida && a.urgencia === 'alta').length
  const transferenciasPendientes = transferencias.filter(t => t.estado !== 'recibida').length
  const totalBoticas = boticas.length

  const stockPorBotica = boticas.map(b => {
    const stockB = stock.filter(s => s.ubicacionId === b.id)
    return {
      nombre: b.nombre,
      total: stockB.reduce((a, s) => a + s.cantidadDisponible, 0),
      bajoStock: stockB.filter(s => clasificarAlerta(s) === 'bajo' || clasificarAlerta(s) === 'sin_stock').length,
    }
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Dashboard Operativo</h1>
        <p className="text-sm sm:text-secundario text-secundario mt-1">Visión global de la red de boticas</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <TarjetaMetrica etiqueta="Stock Total Red" valor={formatearNumero(stockTotal)} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Activos" valor={productosActivos} icono={Package} />
        <TarjetaMetrica etiqueta="Alertas Críticas" valor={alertasCriticas} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Transferencias" valor={transferenciasPendientes} icono={Truck} />
        <TarjetaMetrica etiqueta="Boticas" valor={totalBoticas} icono={CalendarClock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Stock por Botica">
          <div className="space-y-3">
            {stockPorBotica.map(b => (
              <div key={b.nombre} className="flex items-center justify-between p-3 bg-fondo rounded-md">
                <div>
                  <p className="text-cuerpo font-medium text-principal">{b.nombre}</p>
                  <p className="text-etiqueta text-secundario">{b.bajoStock} productos bajo stock</p>
                </div>
                <span className="text-h3 text-marca-principal font-semibold">{formatearNumero(b.total)}</span>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Alertas Recientes">
          <div className="space-y-3">
            {alertas.filter(a => !a.leida).slice(0, 5).map(alerta => (
              <div key={alerta.id} className="flex items-start gap-3 p-3 bg-fondo rounded-md">
                <Insignia color={alerta.urgencia === 'alta' ? 'rojo' : alerta.urgencia === 'media' ? 'amarillo' : 'gris'}>
                  {alerta.tipo}
                </Insignia>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-principal line-clamp-2">{alerta.mensaje}</p>
                  <p className="text-xs text-secundario mt-1">{formatearFechaRelativa(alerta.fechaCreacion)}</p>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Transferencias Recientes">
        <div className="overflow-x-auto">
          <table className="w-full text-cuerpo">
            <thead>
              <tr className="text-left text-etiqueta text-secundario border-b border-estilo">
                <th className="pb-2">Origen</th>
                <th className="pb-2">Destino</th>
                <th className="pb-2 text-right">Items</th>
                <th className="pb-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {transferencias.slice(0, 5).map(t => (
                <tr key={t.id} className="border-b border-estilo last:border-0">
                  <td className="py-2.5">{boticas.find(b => b.id === t.origenId)?.nombre || t.origenId}</td>
                  <td className="py-2.5">{boticas.find(b => b.id === t.destinoId)?.nombre || t.destinoId}</td>
                  <td className="py-2.5 text-right">{t.items.length}</td>
                  <td className="py-2.5 text-right">
                    <Insignia color={t.estado === 'recibida' ? 'verde' : t.estado === 'en_transito' ? 'azul' : 'amarillo'}>
                      {t.estado}
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
