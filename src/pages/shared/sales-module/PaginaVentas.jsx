import { useEffect, useState } from 'react'
import { Eye, XCircle } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Tabla from '@/components/common/Tabla'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import BarraFiltros from '@/components/common/BarraFiltros'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import SelectFiltro from '@/components/common/SelectFiltro'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import Paginacion from '@/components/common/Paginacion'
import Insignia from '@/components/common/Insignia'
import useAutenticacion from '@/state/useAutenticacion'
import { ROLES } from '@/constants/roles'
import { anularVenta, listarVentas, obtenerVenta } from '@/services/supabase/ventas'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerProductos } from '@/services/supabase/productos'
import { formatearNumero, formatearSoles } from '@/utilities/formatearMoneda'
import { formatearFechaHora } from '@/utilities/formatearFecha'

const LIMITE = 10

const COLOR_ESTADO = { registrada: 'verde', anulada: 'rojo' }
const COLOR_RESULTADO = { completa: 'verde', parcial: 'amarillo', no_atendida: 'rojo' }

export default function PaginaVentas() {
  const { usuario } = useAutenticacion()
  const esBotica = usuario?.rol === ROLES.VISOR_BOTICA
  const esAdmin = usuario?.rol === ROLES.ADMIN_CENTRAL
  const [ventas, setVentas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [opciones, setOpciones] = useState({ boticas: [], productos: [] })
  const [filtros, setFiltros] = useState({ busqueda: '', boticaId: '', productoId: '', fechaDesde: '', fechaHasta: '', estado: '', resultado: '' })

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
        const res = await listarVentas({ ...filtros, pagina, limite: LIMITE })
        if (cancelado) return
        setVentas(res.datos || [])
        setTotal(res.total || 0)
        setResumen(res.resumen || null)
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
    setFiltros({ busqueda: '', boticaId: '', productoId: '', fechaDesde: '', fechaHasta: '', estado: '', resultado: '' })
    setPagina(1)
  }

  async function abrirDetalle(venta) {
    setCargandoDetalle(true)
    setError(null)
    try {
      setDetalle(await obtenerVenta(venta.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function confirmarAnulacion(venta) {
    const motivo = window.prompt(`Motivo de anulación para ${venta.numeroVenta}. Debe tener al menos 10 caracteres.`)
    if (!motivo) return
    setError(null)
    try {
      await anularVenta(venta.id, motivo)
      const res = await listarVentas({ ...filtros, pagina, limite: LIMITE })
      setVentas(res.datos || [])
      setTotal(res.total || 0)
      setResumen(res.resumen || null)
      if (detalle?.id === venta.id) setDetalle(await obtenerVenta(venta.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const columnas = [
    { campo: 'fechaVenta', encabezado: 'Fecha/hora', render: r => formatearFechaHora(r.fechaVenta) },
    { campo: 'numeroVenta', encabezado: 'N.° venta', render: r => <span className="font-mono text-xs">{r.numeroVenta}</span> },
    ...(!esBotica ? [{ campo: 'botica', encabezado: 'Botica' }] : []),
    { campo: 'productosResumen', encabezado: 'Productos', render: r => <span title={r.productosResumen}>{r.totalItems > 1 ? `${r.totalItems} productos` : r.productosResumen}</span> },
    { campo: 'cantidadSolicitada', encabezado: 'Solicitada' },
    { campo: 'cantidadAtendida', encabezado: 'Atendida' },
    { campo: 'demandaNoAtendida', encabezado: 'No atendida' },
    { campo: 'total', encabezado: 'Total', render: r => formatearSoles(r.total) },
    { campo: 'resultadoAtencion', encabezado: 'Resultado', render: r => <Insignia color={COLOR_RESULTADO[r.resultadoAtencion] || 'gris'}>{r.resultadoAtencion}</Insignia> },
    { campo: 'estado', encabezado: 'Estado', render: r => <Insignia color={COLOR_ESTADO[r.estado] || 'gris'}>{r.estado}</Insignia> },
    { campo: 'acciones', encabezado: '', render: r => <div className="flex gap-2"><button onClick={e => { e.stopPropagation(); abrirDetalle(r) }} className="text-marca-principal hover:underline"><Eye className="h-4 w-4" /></button>{esAdmin && r.estado === 'registrada' && <button onClick={e => { e.stopPropagation(); confirmarAnulacion(r) }} className="text-estado-critico hover:underline"><XCircle className="h-4 w-4" /></button>}</div> },
  ]

  const totalPaginas = Math.max(Math.ceil(total / LIMITE), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Ventas</h1>
        <p className="text-secundario mt-1">
          {total} ventas encontradas · {esBotica ? 'Botica asignada' : 'Alcance de la organización'}
        </p>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar ventas" mensaje={error} alCerrar={() => setError(null)} />}

      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Metrica etiqueta="Solicitadas" valor={formatearNumero(resumen.unidadesSolicitadas)} />
          <Metrica etiqueta="Atendidas" valor={formatearNumero(resumen.unidadesAtendidas)} />
          <Metrica etiqueta="No atendida" valor={formatearNumero(resumen.demandaNoAtendida)} />
          <Metrica etiqueta="Fill Rate" valor={`${resumen.fillRate}%`} />
          <Metrica etiqueta="Importe" valor={formatearSoles(resumen.importeVentas)} />
        </div>
      )}

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={filtros.busqueda} alCambiar={valor => actualizarFiltro('busqueda', valor)} placeholder="Buscar venta o producto..." className="w-full sm:w-72" />
        {!esBotica && <SelectFiltro valor={filtros.boticaId} alCambiar={valor => actualizarFiltro('boticaId', valor)} opciones={opciones.boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))} placeholder="Todas las boticas" />}
        <SelectBusquedaFiltro valor={filtros.productoId} alCambiar={valor => actualizarFiltro('productoId', valor)} opciones={opciones.productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))} placeholder="Producto" />
        <SelectFiltro valor={filtros.estado} alCambiar={valor => actualizarFiltro('estado', valor)} opciones={[{ valor: 'registrada', etiqueta: 'Registrada' }, { valor: 'anulada', etiqueta: 'Anulada' }]} placeholder="Todos los estados" />
        {esAdmin && <SelectFiltro valor={filtros.resultado} alCambiar={valor => actualizarFiltro('resultado', valor)} opciones={[{ valor: 'completa', etiqueta: 'Completa' }, { valor: 'parcial', etiqueta: 'Parcial' }, { valor: 'no_atendida', etiqueta: 'No atendida' }]} placeholder="Todos los resultados" />}
        <label className="flex flex-col gap-1 text-xs text-secundario">Desde<input type="date" value={filtros.fechaDesde} onChange={e => actualizarFiltro('fechaDesde', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
        <label className="flex flex-col gap-1 text-xs text-secundario">Hasta<input type="date" value={filtros.fechaHasta} onChange={e => actualizarFiltro('fechaHasta', e.target.value)} className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal" /></label>
      </BarraFiltros>

      {cargando ? <p className="text-secundario py-8 text-center">Cargando ventas...</p> : <Tabla columnas={columnas} datos={ventas} busqueda={false} paginacion={false} mensajeVacio="Aún no hay ventas operativas registradas para este alcance." alClickFila={abrirDetalle} />}
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={total} alCambiar={setPagina} />

      {detalle && (
        <DetalleVenta venta={detalle} cargando={cargandoDetalle} esAdmin={esAdmin} alCerrar={() => setDetalle(null)} alAnular={() => confirmarAnulacion(detalle)} />
      )}
    </div>
  )
}

function Metrica({ etiqueta, valor }) {
  return <Tarjeta><p className="text-xs text-secundario">{etiqueta}</p><p className="text-2xl font-semibold text-principal mt-1">{valor}</p></Tarjeta>
}

function DetalleVenta({ venta, cargando, esAdmin, alCerrar, alAnular }) {
  if (cargando) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-fondo-secundario border border-estilo rounded-lg shadow-estilo w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-estilo">
          <div>
            <h2 className="text-h2 text-principal">Venta {venta.numeroVenta}</h2>
            <p className="text-secundario">{formatearFechaHora(venta.fechaVenta)} · {venta.botica}</p>
          </div>
          <div className="flex gap-2">
            {esAdmin && venta.estado === 'registrada' && <Boton variante="peligro" onClick={alAnular}>Anular</Boton>}
            <Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <CampoDetalle etiqueta="Registrado por" valor={venta.registradoPorNombre} />
            <CampoDetalle etiqueta="Estado" valor={venta.estado} />
            <CampoDetalle etiqueta="Resultado" valor={venta.resultadoAtencion} />
            <CampoDetalle etiqueta="Total" valor={formatearSoles(venta.total)} />
          </div>
          {venta.estado === 'anulada' && <Alerta tipo="advertencia" titulo="Venta anulada" mensaje={venta.motivoAnulacion || 'Sin motivo registrado'} />}
          <div className="space-y-4">
            {venta.items.map(item => (
              <div key={item.id} className="border border-estilo rounded-lg p-4 bg-fondo">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-principal">{item.producto}</p>
                    <p className="text-xs text-secundario font-mono">{item.codigoProducto}</p>
                  </div>
                  <p className="font-semibold text-principal">{formatearSoles(item.importeTotal)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
                  <CampoDetalle etiqueta="Solicitada" valor={item.cantidadSolicitada} />
                  <CampoDetalle etiqueta="Atendida" valor={item.cantidadAtendida} />
                  <CampoDetalle etiqueta="No atendida" valor={item.demandaNoAtendida} />
                  <CampoDetalle etiqueta="Precio histórico" valor={formatearSoles(item.precioUnitario)} />
                  <CampoDetalle etiqueta="Motivo" valor={item.motivoNoAtencion || '-'} />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-principal">Lotes FEFO utilizados</p>
                  {item.lotes.length === 0 ? <p className="text-sm text-secundario mt-1">Sin lotes porque no hubo unidades atendidas.</p> : (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                      {item.lotes.map(lote => <div key={lote.loteId} className="text-sm border border-estilo rounded-md p-2"><span className="font-mono">{lote.numeroLote}</span><br /><span className="text-secundario">Vence {lote.fechaVencimiento} · {lote.cantidad} und.</span></div>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-2 text-sm">
              <FilaTotal etiqueta="Subtotal" valor={formatearSoles(venta.subtotal)} />
              <FilaTotal etiqueta="IGV" valor={formatearSoles(venta.igv)} />
              <FilaTotal etiqueta="Total" valor={formatearSoles(venta.total)} fuerte />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CampoDetalle({ etiqueta, valor }) {
  return <div><p className="text-xs text-secundario">{etiqueta}</p><p className="font-medium text-principal">{valor ?? '-'}</p></div>
}

function FilaTotal({ etiqueta, valor, fuerte = false }) {
  return <div className={`flex justify-between ${fuerte ? 'text-base font-semibold text-principal' : 'text-secundario'}`}><span>{etiqueta}</span><span>{valor}</span></div>
}
