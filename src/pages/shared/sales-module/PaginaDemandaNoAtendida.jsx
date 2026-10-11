import { useEffect, useState } from 'react'
import Tarjeta from '@/components/common/Tarjeta'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import BarraFiltros from '@/components/common/BarraFiltros'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import Paginacion from '@/components/common/Paginacion'
import { listarDemandaNoAtendida } from '@/services/supabase/ventas'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { formatearNumero } from '@/utilities/formatearMoneda'
import { formatearFechaHora } from '@/utilities/formatearFecha'

const LIMITE = 10

export default function PaginaDemandaNoAtendida() {
  const [datos, setDatos] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [opciones, setOpciones] = useState({ boticas: [], productos: [] })
  const [filtros, setFiltros] = useState({ busqueda: '', boticaId: '', productoId: '', motivo: '', fechaDesde: '', fechaHasta: '' })

  useEffect(() => {
    Promise.all([
      listarBoticas({ activas: true }).catch(() => []),
      obtenerProductos({ activos: true }).catch(() => []),
    ]).then(([boticas, productos]) => setOpciones({ boticas, productos }))
  }, [])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const res = await listarDemandaNoAtendida({ ...filtros, pagina, limite: LIMITE })
        if (cancelado) return
        setDatos(res.datos || [])
        setTotal(res.total || 0)
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [filtros, pagina])

  function actualizarFiltro(nombre, valor) {
    setFiltros(prev => ({ ...prev, [nombre]: valor }))
    setPagina(1)
  }

  function limpiarFiltros() {
    setFiltros({ busqueda: '', boticaId: '', productoId: '', motivo: '', fechaDesde: '', fechaHasta: '' })
    setPagina(1)
  }

  const columnas = [
    { campo: 'fechaVenta', encabezado: 'Fecha/hora', render: r => formatearFechaHora(r.fechaVenta) },
    { campo: 'numeroVenta', encabezado: 'N.° venta', render: r => <span className="font-mono text-xs">{r.numeroVenta}</span> },
    { campo: 'botica', encabezado: 'Botica' },
    { campo: 'producto', encabezado: 'Producto', render: r => <div><p>{r.producto}</p><p className="text-xs text-secundario font-mono">{r.codigoProducto}</p></div> },
    { campo: 'cantidadSolicitada', encabezado: 'Solicitada' },
    { campo: 'cantidadAtendida', encabezado: 'Atendida' },
    { campo: 'demandaNoAtendida', encabezado: 'Demanda no atendida' },
    { campo: 'motivoNoAtencion', encabezado: 'Motivo', render: r => r.motivoNoAtencion || '-' },
  ]

  const totalPaginas = Math.max(Math.ceil(total / LIMITE), 1)
  const totalDemandaPagina = datos.reduce((acc, item) => acc + item.demandaNoAtendida, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Demanda no atendida</h1>
        <p className="text-secundario mt-1">{total} registros encontrados</p>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar la demanda" mensaje={error} alCerrar={() => setError(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Tarjeta><p className="text-xs text-secundario">Registros encontrados</p><p className="text-2xl font-semibold text-principal mt-1">{formatearNumero(total)}</p></Tarjeta>
        <Tarjeta><p className="text-xs text-secundario">Demanda visible en página</p><p className="text-2xl font-semibold text-principal mt-1">{formatearNumero(totalDemandaPagina)}</p></Tarjeta>
      </div>

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={filtros.busqueda} alCambiar={valor => actualizarFiltro('busqueda', valor)} placeholder="Buscar producto o venta..." className="w-full sm:w-72" />
        <SelectFiltro valor={filtros.boticaId} alCambiar={valor => actualizarFiltro('boticaId', valor)} opciones={opciones.boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))} placeholder="Todas las boticas" />
        <SelectBusquedaFiltro valor={filtros.productoId} alCambiar={valor => actualizarFiltro('productoId', valor)} opciones={opciones.productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))} placeholder="Producto" />
        <SelectFiltro valor={filtros.motivo} alCambiar={valor => actualizarFiltro('motivo', valor)} opciones={[{ valor: 'stock_insuficiente', etiqueta: 'Stock insuficiente' }, { valor: 'sin_stock', etiqueta: 'Sin stock' }, { valor: 'otro', etiqueta: 'Otro' }]} placeholder="Todos los motivos" />
        <label className="flex flex-col gap-1 text-xs text-secundario">Desde<input type="date" value={filtros.fechaDesde} onChange={e => actualizarFiltro('fechaDesde', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
        <label className="flex flex-col gap-1 text-xs text-secundario">Hasta<input type="date" value={filtros.fechaHasta} onChange={e => actualizarFiltro('fechaHasta', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
      </BarraFiltros>

      {cargando ? <p className="text-secundario py-8 text-center">Cargando demanda no atendida...</p> : <Tabla columnas={columnas} datos={datos} busqueda={false} paginacion={false} mensajeVacio="Aún no hay demanda no atendida registrada." />}
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={total} alCambiar={setPagina} />
    </div>
  )
}
