import { Package, AlertTriangle, Boxes, Truck } from 'lucide-react'

import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'

import { productos } from '@/mock-data/productos'
import { stock } from '@/mock-data/stock'
import { alertas } from '@/mock-data/alertas'
import { transferencias } from '@/mock-data/transferencias'
import { predicciones } from '@/mock-data/predicciones'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { COLORES_ALERTA, ETIQUETAS_ALERTA } from '@/constants/tiposAlerta'

export default function PaginaDashboardCentral() {
  const stockTotal = stock.reduce((acc, s) => acc + s.stockDisponible, 0)
  const productosActivos = productos.filter(p => p.estado === 'activo').length
  const alertasActivas = alertas.filter(a => !a.leida).length
  const transferenciasEnTransito = transferencias.filter(t => t.estado === 'en_transito').length

  const datosTendencia = [
    { mes: 'Oct', stock: 1100 }, { mes: 'Nov', stock: 1250 },
    { mes: 'Dic', stock: 1180 }, { mes: 'Ene', stock: 1320 },
    { mes: 'Feb', stock: 1280 }, { mes: 'Mar', stock: 1350 },
    { mes: 'Abr', stock: 1247 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 text-neutro-negro">Dashboard</h1>
        <p className="text-secundario text-neutro-gris-texto mt-1">Resumen general del sistema de inventario</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <TarjetaMetrica etiqueta="Stock Total" valor={formatearNumero(stockTotal)} variacion={5.2} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Activos" valor={productosActivos} variacion={2.0} icono={Package} />
        <TarjetaMetrica etiqueta="Alertas Activas" valor={alertasActivas} variacion={-12.5} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Transferencias en Tránsito" valor={transferenciasEnTransito} icono={Truck} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Tarjeta titulo="Tendencia de Stock Total" className="lg:col-span-2">
          <GraficaLinea datos={datosTendencia} lineas={[{ clave: 'stock', etiqueta: 'Stock Total', color: '#107C41' }]} altura={280} />
        </Tarjeta>
        <Tarjeta titulo="Alertas Recientes">
          <div className="space-y-3">
            {alertas.filter(a => !a.leida).slice(0, 5).map(alerta => (
              <div key={alerta.id} className="flex items-start gap-3 p-3 bg-neutro-blanco-suave rounded-boton">
                <Insignia color={COLORES_ALERTA[alerta.tipo] || 'gris'}>{ETIQUETAS_ALERTA[alerta.tipo] || alerta.tipo}</Insignia>
                <div className="flex-1 min-w-0">
                  <p className="text-etiqueta text-neutro-negro-suave line-clamp-2">{alerta.mensaje}</p>
                  <p className="text-etiqueta text-neutro-gris-texto mt-1">{formatearFechaRelativa(alerta.fechaCreacion)}</p>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Predicciones Destacadas" descripcion="Pronósticos del modelo SARIMA + XGBoost para el próximo mes">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {predicciones.slice(0, 3).map(pred => (
            <div key={pred.id} className="p-4 bg-neutro-blanco-suave rounded-tarjeta border border-neutro-gris-borde">
              <p className="text-cuerpo font-semibold text-neutro-negro">{pred.nombreProducto}</p>
              <p className="text-etiqueta text-neutro-gris-texto">{pred.nombreBotica}</p>
              <div className="mt-3">
                <p className="text-h2 text-marca-principal">{pred.pronostico[0]?.predicho} uds</p>
                <p className="text-etiqueta text-neutro-gris-texto">Rango: {pred.pronostico[0]?.intervaloInf} — {pred.pronostico[0]?.intervaloSup}</p>
              </div>
              <div className="mt-2"><Insignia color="verde">MAPE: {pred.metricas.mape}%</Insignia></div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  )
}
