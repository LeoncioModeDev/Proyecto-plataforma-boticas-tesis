import Tarjeta from '@/components/common/Tarjeta'
import GraficaBarras from '@/components/charts/GraficaBarras'
import { movimientos } from '@/mock-data/movimientos'
import { ETIQUETAS_MOVIMIENTO } from '@/constants/tiposMovimiento'

export default function ReporteMovimientos() {
  const resumen = {}
  movimientos.forEach(m => { resumen[m.tipo] = (resumen[m.tipo] || 0) + 1 })
  const datosGrafica = Object.entries(resumen).map(([tipo, total]) => ({ nombre: ETIQUETAS_MOVIMIENTO[tipo], total }))
  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Reporte de Movimientos</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Movimientos por Tipo"><GraficaBarras datos={datosGrafica} barras={[{ clave: 'total', etiqueta: 'Total' }]} altura={280} /></Tarjeta>
        <Tarjeta titulo="Resumen">
          <div className="space-y-3">
            {datosGrafica.map(d => (
              <div key={d.nombre} className="flex items-center justify-between py-2 border-b border-estilo last:border-0">
                <span className="text-cuerpo">{d.nombre}</span>
                <span className="text-h3 text-marca-principal">{d.total}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 border-t-2 border-principal">
              <span className="text-cuerpo font-semibold">Total</span>
              <span className="text-h3 text-principal">{movimientos.length}</span>
            </div>
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}
