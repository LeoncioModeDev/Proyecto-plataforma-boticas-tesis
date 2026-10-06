import { useEffect, useState } from 'react'
import { BarChart3, Building2, Package, Percent, TrendingUp } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import Tabla from '@/components/common/Tabla'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectFiltro from '@/components/common/SelectFiltro'
import { obtenerReportesVentas } from '@/services/supabase/ventas'
import { listarBoticas } from '@/services/supabase/boticas'
import { formatearNumero, formatearSoles } from '@/utilities/formatearMoneda'

export default function PaginaReportesVentas() {
  const [reporte, setReporte] = useState(null)
  const [boticas, setBoticas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState({ boticaId: '', fechaDesde: '', fechaHasta: '', resultado: '' })

  useEffect(() => {
    listarBoticas({ activas: true }).then(setBoticas).catch(() => setBoticas([]))
  }, [])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const datos = await obtenerReportesVentas(filtros)
        if (!cancelado) setReporte(datos)
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [filtros])

  function actualizarFiltro(nombre, valor) {
    setFiltros(prev => ({ ...prev, [nombre]: valor }))
  }

  function limpiarFiltros() {
    setFiltros({ boticaId: '', fechaDesde: '', fechaHasta: '', resultado: '' })
  }

  const resumen = reporte?.resumen || {}
  const columnasBotica = [
    { campo: 'etiqueta', encabezado: 'Botica' },
    { campo: 'solicitadas', encabezado: 'Solicitadas', render: r => formatearNumero(r.solicitadas) },
    { campo: 'atendidas', encabezado: 'Atendidas', render: r => formatearNumero(r.atendidas) },
    { campo: 'demandaNoAtendida', encabezado: 'No atendida', render: r => formatearNumero(r.demandaNoAtendida) },
    { campo: 'fillRate', encabezado: 'Fill Rate', render: r => `${r.fillRate}%` },
    { campo: 'total', encabezado: 'Importe', render: r => formatearSoles(r.total) },
  ]
  const columnasEvolucion = [
    { campo: 'fecha', encabezado: 'Fecha' },
    { campo: 'solicitadas', encabezado: 'Solicitadas', render: r => formatearNumero(r.solicitadas) },
    { campo: 'atendidas', encabezado: 'Atendidas', render: r => formatearNumero(r.atendidas) },
    { campo: 'demandaNoAtendida', encabezado: 'No atendida', render: r => formatearNumero(r.demandaNoAtendida) },
    { campo: 'total', encabezado: 'Importe', render: r => formatearSoles(r.total) },
  ]
  const columnasProducto = [
    { campo: 'producto', encabezado: 'Producto', render: r => <div><p>{r.producto}</p><p className="text-xs text-secundario font-mono">{r.codigoProducto}</p></div> },
    { campo: 'solicitadas', encabezado: 'Solicitadas', render: r => formatearNumero(r.solicitadas) },
    { campo: 'atendidas', encabezado: 'Atendidas', render: r => formatearNumero(r.atendidas) },
    { campo: 'demandaNoAtendida', encabezado: 'No atendida', render: r => formatearNumero(r.demandaNoAtendida) },
    { campo: 'fillRate', encabezado: 'Fill Rate', render: r => `${r.fillRate}%` },
    { campo: 'total', encabezado: 'Importe', render: r => formatearSoles(r.total) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Reportes de ventas</h1>
        <p className="text-secundario mt-1">Indicadores operativos basados en ventas registradas. Las ventas anuladas quedan excluidas.</p>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar reportes" mensaje={error} alCerrar={() => setError(null)} />}

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <SelectFiltro valor={filtros.boticaId} alCambiar={valor => actualizarFiltro('boticaId', valor)} opciones={boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))} placeholder="Todas las boticas" />
        <SelectFiltro valor={filtros.resultado} alCambiar={valor => actualizarFiltro('resultado', valor)} opciones={[{ valor: 'completa', etiqueta: 'Completa' }, { valor: 'parcial', etiqueta: 'Parcial' }, { valor: 'no_atendida', etiqueta: 'No atendida' }]} placeholder="Todos los resultados" />
        <label className="flex flex-col gap-1 text-xs text-secundario">Desde<input type="date" value={filtros.fechaDesde} onChange={e => actualizarFiltro('fechaDesde', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
        <label className="flex flex-col gap-1 text-xs text-secundario">Hasta<input type="date" value={filtros.fechaHasta} onChange={e => actualizarFiltro('fechaHasta', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
      </BarraFiltros>

      {cargando ? <p className="text-secundario py-8 text-center">Cargando reportes...</p> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Metrica icono={Package} etiqueta="Unidades solicitadas" valor={formatearNumero(resumen.unidadesSolicitadas || 0)} />
            <Metrica icono={BarChart3} etiqueta="Unidades atendidas" valor={formatearNumero(resumen.unidadesAtendidas || 0)} />
            <Metrica icono={TrendingUp} etiqueta="Demanda no atendida" valor={formatearNumero(resumen.demandaNoAtendida || 0)} />
            <Metrica icono={Percent} etiqueta="Fill Rate" valor={`${resumen.fillRate || 0}%`} />
            <Metrica icono={Building2} etiqueta="Importe de ventas" valor={formatearSoles(resumen.importeVentas || 0)} />
          </div>

          <Tarjeta titulo="Ventas por botica">
            <Tabla columnas={columnasBotica} datos={reporte?.porBotica || []} busqueda={false} paginacion={false} mensajeVacio="Sin ventas registradas para los filtros seleccionados." />
          </Tarjeta>

          <Tarjeta titulo="Ventas por producto">
            <Tabla columnas={columnasProducto} datos={reporte?.porProducto || []} busqueda={false} paginacion={false} mensajeVacio="Sin productos vendidos para los filtros seleccionados." />
          </Tarjeta>

          <Tarjeta titulo="Evolución temporal">
            <Tabla columnas={columnasEvolucion} datos={reporte?.evolucion || []} busqueda={false} paginacion={false} mensajeVacio="Sin evolución disponible para los filtros seleccionados." />
          </Tarjeta>
        </>
      )}
    </div>
  )
}

function Metrica({ icono: Icono, etiqueta, valor }) {
  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-secundario">{etiqueta}</p>
          <p className="text-2xl font-semibold text-principal mt-1">{valor}</p>
        </div>
        <Icono className="h-5 w-5 text-marca-principal" />
      </div>
    </Tarjeta>
  )
}
