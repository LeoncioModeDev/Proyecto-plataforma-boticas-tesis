import { useState, useEffect } from 'react'
import { Package, AlertTriangle, Boxes, Truck, Building, TrendingUp } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import GraficaLinea from '@/components/charts/GraficaLinea'
import Insignia from '@/components/common/Insignia'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerProductos } from '@/services/supabase/productos'
import { obtenerAlertas } from '@/services/supabase/alertas'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { ESTADOS_TRANSFERENCIA, ETIQUETAS_TRANSFERENCIA, COLORES_TRANSFERENCIA } from '@/constants/transferencias'

const MAPEO_COLORES = {
  amarillo: 'amarillo',
  azul: 'azul',
  verde: 'verde',
  rojo: 'rojo',
  naranja: 'naranja',
}

export default function PaginaDashboardOperaciones() {
  const [stock, setStock] = useState([])
  const [productos, setProductos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [boticas, setBoticas] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      obtenerStockPorUbicacion(),
      obtenerProductos({ activos: true }),
      obtenerAlertas({ soloNoResueltas: true }),
      listarBoticas({ activas: true }),
      obtenerTransferencias(),
      obtenerMovimientos(),
    ]).then(([stockData, prodData, alertasData, boticasData, transData, movData]) => {
      setStock(stockData)
      setProductos(prodData)
      setAlertas(alertasData)
      setBoticas(boticasData)
      setTransferencias(transData)
      setMovimientos(movData)
    }).catch(() => {}).finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando dashboard...</p></div>
  }

  const stockTotal = stock.reduce((acc, s) => acc + s.cantidadDisponible, 0)
  const productosActivos = productos.length
  const productosCriticos = stock.filter(s => s.cantidadDisponible < s.stockMinimo).length
  const alertasPendientes = alertas.length
  const transferenciasActivas = transferencias.filter(t => t.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO).length
  const totalBoticas = boticas.length

  const stockPorBotica = boticas.map(b => {
    const stockB = stock.filter(s => s.ubicacionId === b.id)
    return {
      nombre: b.nombre,
      id: b.id,
      total: stockB.reduce((a, s) => a + s.cantidadDisponible, 0),
      bajoStock: stockB.filter(s => s.cantidadDisponible < s.stockMinimo).length,
    }
  })

  const tendenciaMovimientos = (() => {
    const agrupado = {}
    movimientos.forEach(m => {
      const mes = m.createdAt?.substring(0, 7)
      if (!mes) return
      if (!agrupado[mes]) agrupado[mes] = { mes, entradas: 0, salidas: 0, transferencias: 0 }
      if (m.tipo === 'entrada') agrupado[mes].entradas += m.cantidad
      else if (m.tipo === 'salida') agrupado[mes].salidas += Math.abs(m.cantidad)
      if (m.transferenciaId) agrupado[mes].transferencias += Math.abs(m.cantidad)
    })
    return Object.values(agrupado).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6)
  })()

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-h1 text-principal font-semibold">Dashboard Operativo</h1>
        <p className="text-sm sm:text-secundario text-secundario mt-1">Visión global de la red de boticas</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <TarjetaMetrica etiqueta="Stock Total Red" valor={formatearNumero(stockTotal)} icono={Boxes} />
        <TarjetaMetrica etiqueta="Productos Activos" valor={productosActivos} icono={Package} />
        <TarjetaMetrica etiqueta="Productos Críticos" valor={productosCriticos} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Transferencias Activas" valor={transferenciasActivas} icono={Truck} />
        <TarjetaMetrica etiqueta="Boticas" valor={totalBoticas} icono={Building} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Stock por Ubicación">
          <div className="space-y-3">
            {stockPorBotica.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-fondo rounded-md">
                <div>
                  <p className="text-cuerpo font-medium text-principal">{b.nombre}</p>
                  <p className="text-etiqueta text-secundario">{b.bajoStock} productos bajo stock mínimo</p>
                </div>
                <span className="text-h3 text-marca-principal font-semibold">{formatearNumero(b.total)}</span>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Alertas Pendientes">
          <div className="space-y-3">
            {alertas.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-fondo rounded-md">
                <Insignia color={a.urgencia === 'alta' ? 'rojo' : a.urgencia === 'media' ? 'amarillo' : 'gris'}>
                  {a.tipo}
                </Insignia>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-principal line-clamp-2">{a.nombreProducto} - {a.nombreBotica}</p>
                  <p className="text-xs text-secundario mt-1">{formatearFechaRelativa(a.generadoEn)}</p>
                </div>
              </div>
            ))}
            {alertas.length === 0 && <p className="text-secundario text-sm text-center py-4">No hay alertas pendientes</p>}
          </div>
        </Tarjeta>
      </div>

      {tendenciaMovimientos.length > 0 && (
        <Tarjeta titulo="Tendencia de Movimientos de Inventario">
          <GraficaLinea
            datos={tendenciaMovimientos}
            lineas={[
              { clave: 'entradas', color: '#22c55e', etiqueta: 'Entradas' },
              { clave: 'salidas', color: '#ef4444', etiqueta: 'Salidas' },
              { clave: 'transferencias', color: '#3b82f6', etiqueta: 'Transferencias' },
            ]}
          />
        </Tarjeta>
      )}

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
                  <td className="py-2.5">{t.origen?.nombre || (t.origenTipo === 'drogueria' ? 'Droguería Central' : t.origenId)}</td>
                  <td className="py-2.5">{t.destino?.nombre || t.destinoId}</td>
                  <td className="py-2.5 text-right">{t.items?.length || 0}</td>
                  <td className="py-2.5 text-right">
                    <Insignia color={MAPEO_COLORES[COLORES_TRANSFERENCIA[t.estado]] || 'gris'}>
                      {ETIQUETAS_TRANSFERENCIA[t.estado] || t.estado}
                    </Insignia>
                  </td>
                </tr>
              ))}
              {transferencias.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-secundario">Sin transferencias</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
