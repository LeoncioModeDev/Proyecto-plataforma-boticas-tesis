import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, Eye, XCircle } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import BarraFiltros from '@/components/common/BarraFiltros'
import SelectBusquedaFiltro from '@/components/common/SelectBusquedaFiltro'
import SelectFiltro from '@/components/common/SelectFiltro'
import { listarBoticas } from '@/services/supabase/boticas'
import { listarProveedores } from '@/services/supabase/proveedores'
import { obtenerProductos } from '@/services/supabase/productos'
import { aprobarRecomendacion, generarRecomendacionCompra, generarRecomendacionReposicion, obtenerRecomendaciones, rechazarRecomendacion } from '@/services/ml-model/recomendacionesML'
import { useMLStatus } from '@/services/ml-model/useMLStatus'

function textoTipo(tipo) {
  return tipo === 'ORDEN_COMPRA' || tipo === 'COMPRA' ? 'COMPRA' : 'REPOSICION_INTERNA'
}

function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—'
}

function formatearMoneda(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? `S/ ${numero.toFixed(2)}` : '—'
}

function textoTipoVisible(tipo) {
  return tipo === 'COMPRA' ? 'Compra externa' : 'Reposición interna'
}

function textoEstado(estado) {
  const etiquetas = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', RECHAZADA: 'Rechazada' }
  return etiquetas[estado] || estado || '—'
}

function textoUrgencia(valor) {
  const etiquetas = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }
  return etiquetas[String(valor || '').toUpperCase()] || valor || '—'
}

function costoEstimado(rec) {
  return Number(rec.cantidadFinal || 0) * Number(rec.precioReferencial || 0)
}

function estadoOperativo(rec) {
  if (rec.tipo !== 'REPOSICION_INTERNA') return 'Aprobable'
  if (rec.cantidadNecesaria > 0 && rec.cantidadFinal <= 0) return 'Sin stock suficiente en origen'
  if (rec.cantidadFinal < rec.cantidadNecesaria) return 'Parcial por stock de origen'
  return 'Aprobable'
}

function mapearRecomendacion(r) {
  const datos = r.datos_jsonb || r
  const stockDisponible = Number(datos.stock_disponible ?? r.stock_disponible ?? 0)
  const stockReservado = Number(datos.stock_comprometido ?? r.stock_comprometido ?? 0)
  return {
    id: r.id || datos.recomendacion_id,
    tipo: textoTipo(datos.tipo || r.tipo_recomendacion),
    estado: (r.estado || datos.estado || 'pendiente').toUpperCase(),
    productoId: r.producto_id || datos.producto_id,
    boticaId: r.botica_id || r.botica_destino_id || datos.botica_id,
    proveedorId: r.proveedor_id || datos.proveedor_id,
    drogueriaId: r.botica_origen_id || datos.drogueria_id,
    stockDisponible,
    stockFisico: stockDisponible,
    stockComprometido: stockReservado,
    stockDisponibleCalculado: Number(datos.stock_libre ?? r.stock_libre ?? Math.max(stockDisponible - stockReservado, 0)),
    stockEnTransito: Number(datos.stock_en_transito ?? r.stock_en_transito ?? 0),
    stockPorRecibir: Number(datos.stock_por_recibir ?? r.stock_por_recibir ?? 0),
    stockConsiderado: Number(datos.stock_considerado ?? r.stock_considerado ?? 0),
    stockProyectado: Number(datos.stock_proyectado ?? r.stock_proyectado ?? 0),
    stockSeguridad: Number(datos.stock_seguridad ?? r.stock_seguridad ?? 0),
    demandaDuranteLeadTime: Number(datos.demanda_durante_lead_time ?? r.demanda_durante_lead_time ?? 0),
    cantidadBase: Number(datos.cantidad_base ?? r.cantidad_base ?? 0),
    cantidadNecesaria: Number(datos.cantidad_necesaria ?? r.cantidad_necesaria ?? datos.cantidad_base ?? r.cantidad_base ?? 0),
    cantidadTransferible: Number(datos.cantidad_transferible ?? r.cantidad_transferible ?? datos.cantidad_final_transferible ?? r.cantidad_final_transferible ?? datos.cantidad_final ?? r.cantidad_final ?? 0),
    stockDisponibleOrigen: Number(datos.stock_disponible_origen ?? datos.cantidad_disponible_origen ?? r.cantidad_disponible_origen ?? 0),
    cantidadMinimaCompra: datos.cantidad_minima_compra ?? r.cantidad_minima_compra ?? '-',
    multiploEmpaque: datos.multiplo_empaque ?? r.multiplo_empaque ?? '-',
    cantidadFinal: Number(datos.cantidad_final ?? r.cantidad_final ?? r.cantidad_sugerida ?? 0),
    cantidadSugerida: Number(r.cantidad_sugerida ?? datos.cantidad_recomendada ?? datos.cantidad_final ?? 0),
    leadTimeDias: datos.lead_time_dias ?? r.lead_time_dias ?? '-',
    precioReferencial: datos.precio_referencial ?? r.precio_referencial ?? 0,
    estrategia: datos.estrategia ?? r.estrategia ?? '-',
    nivelMadurez: datos.nivel_madurez ?? r.nivel_madurez ?? '-',
    prioridad: datos.prioridad ?? r.nivel_urgencia ?? r.prioridad ?? '-',
    motivo: datos.motivo ?? r.motivo,
    referenciaOperacion: r.transferencia_id || r.orden_compra_id || datos.transferencia_id || datos.orden_compra_id || null,
  }
}

function SeccionDetalle({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-h3 text-principal border-b border-estilo pb-2">{titulo}</h3>
      <div className="grid gap-3 md:grid-cols-2 text-sm">{children}</div>
    </section>
  )
}

function CampoDetalle({ etiqueta, valor, destacado = false }) {
  if (valor === undefined || valor === null || valor === '') return null
  return (
    <div className="rounded-md border border-estilo bg-fondo p-3">
      <p className="text-etiqueta text-secundario">{etiqueta}</p>
      <p className={`font-semibold ${destacado ? 'text-marca-principal text-lg' : 'text-principal'}`}>{valor}</p>
    </div>
  )
}

export default function PaginaRecomendaciones() {
  const estadoML = useMLStatus()
  const [parametrosBusqueda] = useSearchParams()
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState('COMPRA')
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS')
  const [recomendacionIdFiltro, setRecomendacionIdFiltro] = useState('')
  const [recomendaciones, setRecomendaciones] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [aprobarRec, setAprobarRec] = useState(null)
  const [creando, setCreando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [boticasData, productosData, proveedoresData, recs] = await Promise.all([
          listarBoticas({ activas: true }),
          obtenerProductos({ activos: true }),
          listarProveedores({ activos: true }),
          obtenerRecomendaciones(),
        ])
        const boticasActivas = boticasData.filter(b => b.tipo === 'botica')
        setBoticas(boticasData)
        setProductos(productosData)
        setProveedores(proveedoresData)
        const recomendacionesMapeadas = (recs.recomendaciones || []).map(mapearRecomendacion)
        const vieneConFiltros = parametrosBusqueda.toString().length > 0
        setBoticaId(parametrosBusqueda.get('boticaId') || (vieneConFiltros ? '' : boticasActivas[0]?.id || ''))
        setProductoId(parametrosBusqueda.get('productoId') || (vieneConFiltros ? '' : productosData[0]?.id || ''))
        setTipo(parametrosBusqueda.get('tipo') || 'COMPRA')
        setEstadoFiltro(parametrosBusqueda.get('estado') || 'TODOS')
        setRecomendacionIdFiltro(parametrosBusqueda.get('recomendacionId') || '')
        setRecomendaciones(recomendacionesMapeadas)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [parametrosBusqueda])

  const filas = useMemo(() => recomendaciones.filter(r => {
    if (estadoFiltro !== 'TODOS' && r.estado !== estadoFiltro) return false
    if (tipo !== 'TODOS' && r.tipo !== tipo) return false
    if (boticaId && r.boticaId && r.boticaId !== boticaId) return false
    if (productoId && r.productoId && r.productoId !== productoId) return false
    if (recomendacionIdFiltro && r.id !== recomendacionIdFiltro) return false
    return true
  }), [recomendaciones, estadoFiltro, tipo, boticaId, productoId, recomendacionIdFiltro])

  async function recargar() {
    const recs = await obtenerRecomendaciones()
    setRecomendaciones((recs.recomendaciones || []).map(mapearRecomendacion))
  }

  async function generar() {
    setCargando(true)
    setError(null)
    try {
      if (tipo === 'COMPRA') {
        await generarRecomendacionCompra({ producto_id: productoId, horizonte_semanas: 12, nivel_servicio: 0.9 })
      } else {
        await generarRecomendacionReposicion({ botica_id: boticaId, producto_id: productoId, horizonte_semanas: 12, nivel_servicio: 0.9 })
      }
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function rechazar(id) {
    try {
      const motivo = window.prompt('Motivo del rechazo')
      if (motivo === null) return
      await rechazarRecomendacion(id, motivo)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function aprobarYCrear() {
    if (!aprobarRec) return
    setCreando(true)
    setError(null)
    try {
      const resultado = await aprobarRecomendacion(aprobarRec.id)
      const datos = resultado?.datos_para_plataforma || {}
      setExito(aprobarRec.tipo === 'COMPRA'
        ? `Orden de compra ${datos.numero_orden || ''} creada desde recomendación`
        : `Transferencia ${datos.numero_transferencia || ''} creada con FEFO desde recomendación`)

      setAprobarRec(null)
      setTimeout(() => setExito(null), 5000)
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  function obtenerNombreProducto(id) {
    return productos.find(p => p.id === id)?.nombreComercial || id
  }

  function obtenerNombreBotica(id) {
    return boticas.find(b => b.id === id)?.nombre || id
  }

  function obtenerNombreProveedor(id) {
    return proveedores.find(p => p.id === id)?.razonSocial || id
  }

  const opcionesBoticas = boticas.filter(b => b.tipo === 'botica').map(b => ({ valor: b.id, etiqueta: b.nombre }))
  const opcionesProductos = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial || p.nombre || p.id }))
  const opcionesTipo = [
    { valor: 'TODOS', etiqueta: 'Todos los tipos' },
    { valor: 'COMPRA', etiqueta: 'Compra externa' },
    { valor: 'REPOSICION_INTERNA', etiqueta: 'Reposición interna' },
  ]
  const opcionesEstado = [
    { valor: 'TODOS', etiqueta: 'Todos los estados' },
    { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
    { valor: 'CONFIRMADA', etiqueta: 'Aprobada' },
    { valor: 'RECHAZADA', etiqueta: 'Rechazada' },
  ]

  const limpiarFiltros = () => {
    setBoticaId('')
    setProductoId('')
    setTipo('TODOS')
    setEstadoFiltro('TODOS')
    setRecomendacionIdFiltro('')
  }

  const columnasReposicion = [
    { campo: 'productoId', encabezado: 'Producto', render: r => obtenerNombreProducto(r.productoId) },
    { campo: 'boticaId', encabezado: 'Botica destino', render: r => obtenerNombreBotica(r.boticaId) },
    { campo: 'drogueriaId', encabezado: 'Droguería origen', render: r => obtenerNombreBotica(r.drogueriaId) },
    { campo: 'cantidadNecesaria', encabezado: 'Necesidad calculada', render: r => `${formatearNumero(r.cantidadNecesaria)} uds` },
    { campo: 'cantidadTransferible', encabezado: 'Cantidad transferible', render: r => `${formatearNumero(r.cantidadTransferible)} uds` },
    { campo: 'cantidadFinal', encabezado: 'Cantidad final', render: r => `${formatearNumero(r.cantidadFinal)} uds` },
    { campo: 'estadoOperativo', encabezado: 'Estado operativo', render: r => estadoOperativo(r) },
    { campo: 'demandaDuranteLeadTime', encabezado: 'Demanda pronosticada', render: r => `${formatearNumero(r.demandaDuranteLeadTime)} uds` },
    { campo: 'stockFisico', encabezado: 'Stock físico destino', render: r => formatearNumero(r.stockFisico) },
    { campo: 'stockComprometido', encabezado: 'Stock comprometido destino', render: r => formatearNumero(r.stockComprometido) },
    { campo: 'stockDisponibleCalculado', encabezado: 'Stock disponible destino', render: r => formatearNumero(r.stockDisponibleCalculado) },
    { campo: 'stockEnTransito', encabezado: 'Stock en tránsito', render: r => formatearNumero(r.stockEnTransito) },
    { campo: 'stockProyectado', encabezado: 'Stock proyectado', render: r => formatearNumero(r.stockProyectado) },
    { campo: 'stockSeguridad', encabezado: 'Stock de seguridad', render: r => formatearNumero(r.stockSeguridad) },
    { campo: 'leadTimeDias', encabezado: 'Lead time', render: r => `${r.leadTimeDias} días` },
    { campo: 'prioridad', encabezado: 'Urgencia', render: r => textoUrgencia(r.prioridad) },
    { campo: 'estado', encabezado: 'Estado', render: r => textoEstado(r.estado) },
  ]

  const columnasCompra = [
    { campo: 'productoId', encabezado: 'Producto', render: r => obtenerNombreProducto(r.productoId) },
    { campo: 'proveedorId', encabezado: 'Proveedor', render: r => obtenerNombreProveedor(r.proveedorId) },
    { campo: 'cantidadNecesaria', encabezado: 'Necesidad calculada', render: r => `${formatearNumero(r.cantidadNecesaria)} uds` },
    { campo: 'cantidadSugerida', encabezado: 'Cantidad sugerida de compra', render: r => `${formatearNumero(r.cantidadSugerida)} uds` },
    { campo: 'cantidadNecesaria', encabezado: 'Necesidad calculada', render: r => `${formatearNumero(r.cantidadNecesaria)} uds` },
    { campo: 'cantidadFinal', encabezado: 'Cantidad final', render: r => `${formatearNumero(r.cantidadFinal)} uds` },
    { campo: 'demandaDuranteLeadTime', encabezado: 'Demanda pronosticada', render: r => `${formatearNumero(r.demandaDuranteLeadTime)} uds` },
    { campo: 'stockFisico', encabezado: 'Stock físico droguería', render: r => formatearNumero(r.stockFisico) },
    { campo: 'stockComprometido', encabezado: 'Stock comprometido', render: r => formatearNumero(r.stockComprometido) },
    { campo: 'stockDisponibleCalculado', encabezado: 'Stock disponible', render: r => formatearNumero(r.stockDisponibleCalculado) },
    { campo: 'stockEnTransito', encabezado: 'Stock en tránsito', render: r => formatearNumero(r.stockEnTransito) },
    { campo: 'stockPorRecibir', encabezado: 'Stock por recibir', render: r => formatearNumero(r.stockPorRecibir) },
    { campo: 'stockProyectado', encabezado: 'Stock proyectado', render: r => formatearNumero(r.stockProyectado) },
    { campo: 'stockSeguridad', encabezado: 'Stock de seguridad', render: r => formatearNumero(r.stockSeguridad) },
    { campo: 'leadTimeDias', encabezado: 'Lead time', render: r => `${r.leadTimeDias} días` },
    { campo: 'cantidadMinimaCompra', encabezado: 'Cantidad mínima', render: r => r.cantidadMinimaCompra },
    { campo: 'multiploEmpaque', encabezado: 'Múltiplo', render: r => r.multiploEmpaque },
    { campo: 'precioReferencial', encabezado: 'Precio referencial', render: r => formatearMoneda(r.precioReferencial) },
    { campo: 'costoEstimado', encabezado: 'Costo estimado', render: r => formatearMoneda(costoEstimado(r)) },
    { campo: 'prioridad', encabezado: 'Urgencia', render: r => textoUrgencia(r.prioridad) },
    { campo: 'estado', encabezado: 'Estado', render: r => textoEstado(r.estado) },
  ]

  const columnasResumen = [
    { campo: 'tipo', encabezado: 'Tipo', render: r => <Insignia color={r.tipo === 'COMPRA' ? 'azul' : 'verde'}>{textoTipoVisible(r.tipo)}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: r => obtenerNombreProducto(r.productoId) },
    { campo: 'destino', encabezado: 'Destino', render: r => r.tipo === 'COMPRA' ? 'Droguería central' : obtenerNombreBotica(r.boticaId) },
    { campo: 'origen', encabezado: 'Origen / proveedor', render: r => r.tipo === 'COMPRA' ? obtenerNombreProveedor(r.proveedorId) : obtenerNombreBotica(r.drogueriaId) },
    { campo: 'cantidadFinal', encabezado: 'Cantidad final', render: r => `${formatearNumero(r.cantidadFinal)} uds` },
    { campo: 'stockProyectado', encabezado: 'Stock proyectado', render: r => formatearNumero(r.stockProyectado) },
    { campo: 'prioridad', encabezado: 'Urgencia', render: r => textoUrgencia(r.prioridad) },
    { campo: 'estado', encabezado: 'Estado', render: r => textoEstado(r.estado) },
  ]

  const columnaAcciones = { campo: 'acciones', encabezado: 'Acciones', ordenable: false, render: r => (
      <div className="flex gap-1">
        <Boton variante="icono" icono={Eye} onClick={() => setDetalle(r)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro" />
        {r.estado === 'PENDIENTE' && <Boton variante="icono" icono={CheckCircle} onClick={() => setAprobarRec(r)} title={r.cantidadFinal > 0 ? 'Aprobar recomendación' : 'No aprobable: cantidad final en cero'} deshabilitado={r.cantidadFinal <= 0} className="text-marca-principal hover:bg-marca-claro" />}
        {r.estado === 'PENDIENTE' && <Boton variante="icono" icono={XCircle} onClick={() => rechazar(r.id)} title="Rechazar recomendación" className="text-estado-critico hover:bg-red-50 dark:hover:bg-red-950/30" />}
      </div>
    ) }

  const columnas = [
    ...(tipo === 'TODOS' ? columnasResumen : tipo === 'COMPRA' ? columnasCompra : columnasReposicion),
    columnaAcciones,
  ]

  if (cargando && recomendaciones.length === 0 && productos.length === 0) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando recomendaciones...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Recomendaciones Predictivas</h1>
        <p className="text-secundario mt-1">{filas.length} recomendaciones encontradas</p>
      </div>

      {!estadoML.cargando && !estadoML.disponible && <Alerta tipo="error" titulo="Servicio predictivo no disponible" mensaje={estadoML.error} />}
      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}
      {exito && <Alerta tipo="exito" titulo={exito} alCerrar={() => setExito(null)} />}

      <BarraFiltros alLimpiar={limpiarFiltros}>
        <SelectBusquedaFiltro valor={boticaId} alCambiar={setBoticaId} opciones={opcionesBoticas} placeholder="Botica destino" />
        <SelectBusquedaFiltro valor={productoId} alCambiar={setProductoId} opciones={opcionesProductos} placeholder="Producto" className="sm:w-72" />
        <SelectFiltro valor={tipo} alCambiar={setTipo} opciones={opcionesTipo} placeholder="Todos los tipos" />
        <SelectFiltro valor={estadoFiltro} alCambiar={setEstadoFiltro} opciones={opcionesEstado} placeholder="Todos los estados" />
        {recomendacionIdFiltro && <Insignia color="azul">Recomendación filtrada</Insignia>}
        <Boton className="w-full sm:w-auto" onClick={generar} cargando={cargando} deshabilitado={!estadoML.disponible || !boticaId || !productoId || tipo === 'TODOS'}>Generar</Boton>
      </BarraFiltros>

      <Tabla columnas={columnas} datos={filas} tamanoPagina={8} mensajeVacio="No existen recomendaciones pendientes." />

      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de recomendación" tamano="lg">
        {detalle && (
          <div className="space-y-5">
            <SeccionDetalle titulo="Resumen">
              <CampoDetalle etiqueta="Tipo" valor={textoTipoVisible(detalle.tipo)} />
              <CampoDetalle etiqueta="Producto" valor={obtenerNombreProducto(detalle.productoId)} />
              <CampoDetalle etiqueta="Destino" valor={detalle.tipo === 'COMPRA' ? 'Droguería central' : obtenerNombreBotica(detalle.boticaId)} />
              <CampoDetalle etiqueta={detalle.tipo === 'COMPRA' ? 'Proveedor' : 'Origen'} valor={detalle.tipo === 'COMPRA' ? obtenerNombreProveedor(detalle.proveedorId) : obtenerNombreBotica(detalle.drogueriaId)} />
              <CampoDetalle etiqueta="Estado" valor={textoEstado(detalle.estado)} />
              <CampoDetalle etiqueta="Urgencia" valor={textoUrgencia(detalle.prioridad)} />
            </SeccionDetalle>

            <SeccionDetalle titulo="Inventario">
              <CampoDetalle etiqueta="Stock físico" valor={formatearNumero(detalle.stockFisico)} />
              <CampoDetalle etiqueta="Stock comprometido" valor={formatearNumero(detalle.stockComprometido)} />
              <CampoDetalle etiqueta="Stock disponible" valor={formatearNumero(detalle.stockDisponibleCalculado)} />
              <CampoDetalle etiqueta="Stock en tránsito" valor={formatearNumero(detalle.stockEnTransito)} />
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Stock por recibir" valor={formatearNumero(detalle.stockPorRecibir)} />}
              <CampoDetalle etiqueta="Stock considerado" valor={formatearNumero(detalle.stockConsiderado)} />
              <CampoDetalle etiqueta="Stock proyectado" valor={formatearNumero(detalle.stockProyectado)} />
            </SeccionDetalle>

            <SeccionDetalle titulo="Demanda">
              <CampoDetalle etiqueta="Demanda pronosticada" valor={`${formatearNumero(detalle.demandaDuranteLeadTime)} uds`} />
              <CampoDetalle etiqueta="Demanda durante lead time" valor={`${formatearNumero(detalle.demandaDuranteLeadTime)} uds`} />
              <CampoDetalle etiqueta="Stock de seguridad" valor={formatearNumero(detalle.stockSeguridad)} />
              <CampoDetalle etiqueta="Lead time" valor={`${detalle.leadTimeDias} días`} />
            </SeccionDetalle>

            <SeccionDetalle titulo="Cálculo">
              <CampoDetalle etiqueta="Necesidad calculada" valor={`${formatearNumero(detalle.cantidadNecesaria)} uds`} destacado />
              {detalle.tipo === 'REPOSICION_INTERNA' && <CampoDetalle etiqueta="Cantidad sugerida" valor={`${formatearNumero(detalle.cantidadSugerida)} uds`} />}
              {detalle.tipo === 'REPOSICION_INTERNA' && <CampoDetalle etiqueta="Cantidad transferible" valor={`${formatearNumero(detalle.cantidadTransferible)} uds`} />}
              {detalle.tipo === 'REPOSICION_INTERNA' && <CampoDetalle etiqueta="Stock disponible en origen" valor={`${formatearNumero(detalle.stockDisponibleOrigen)} uds`} />}
              {detalle.tipo === 'REPOSICION_INTERNA' && <CampoDetalle etiqueta="Estado operativo" valor={estadoOperativo(detalle)} destacado={detalle.cantidadFinal <= 0} />}
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Cantidad sugerida de compra" valor={`${formatearNumero(detalle.cantidadSugerida)} uds`} />}
              <CampoDetalle etiqueta="Cantidad final" valor={`${formatearNumero(detalle.cantidadFinal)} uds`} destacado />
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Cantidad mínima de compra" valor={detalle.cantidadMinimaCompra} />}
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Múltiplo de empaque" valor={detalle.multiploEmpaque} />}
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Precio referencial" valor={formatearMoneda(detalle.precioReferencial)} />}
              {detalle.tipo === 'COMPRA' && <CampoDetalle etiqueta="Costo estimado" valor={formatearMoneda(costoEstimado(detalle))} destacado />}
            </SeccionDetalle>

            <SeccionDetalle titulo="Operación">
              <CampoDetalle etiqueta="Motivo" valor={detalle.motivo} />
              <CampoDetalle etiqueta="Estrategia" valor={detalle.estrategia} />
              <CampoDetalle etiqueta="Madurez" valor={detalle.nivelMadurez} />
              {detalle.estado === 'CONFIRMADA' && <CampoDetalle etiqueta={detalle.tipo === 'COMPRA' ? 'Orden de compra asociada' : 'Transferencia asociada'} valor={detalle.referenciaOperacion || 'Creada desde la aprobación'} destacado />}
            </SeccionDetalle>
            {detalle.estado === 'PENDIENTE' && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-estilo pt-4">
                <Boton variante="secundario" onClick={() => rechazar(detalle.id)}>Rechazar</Boton>
                <Boton onClick={() => { setDetalle(null); setAprobarRec(detalle) }} deshabilitado={detalle.cantidadFinal <= 0}>Aprobar</Boton>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal abierto={!!aprobarRec} alCerrar={() => { if (!creando) setAprobarRec(null) }} titulo={aprobarRec?.tipo === 'COMPRA' ? 'Aprobar y crear orden de compra' : 'Aprobar y crear transferencia'} tamano="lg">
        {aprobarRec && (
          <div className="space-y-6">
            {aprobarRec.tipo === 'COMPRA' ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-etiqueta text-secundario">Proveedor</p>
                    <p className="font-semibold">{obtenerNombreProveedor(aprobarRec.proveedorId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Producto</p>
                    <p className="font-semibold">{obtenerNombreProducto(aprobarRec.productoId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Cantidad final</p>
                    <p className="font-semibold text-lg text-marca-principal">{Math.round(aprobarRec.cantidadFinal)} uds</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Precio unitario</p>
                    <p className="font-semibold text-lg">S/ {Number(aprobarRec.precioReferencial || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Lead time</p>
                    <p className="font-semibold">{aprobarRec.leadTimeDias} días</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Fecha estimada de entrega</p>
                    <p className="font-semibold">{
                      (() => {
                        const d = new Date()
                        d.setDate(d.getDate() + (Number(aprobarRec.leadTimeDias) || 7))
                        return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
                      })()
                    }</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-etiqueta text-secundario">Motivo</p>
                  <p className="font-semibold">{aprobarRec.motivo || `Recomendación predictiva — ${aprobarRec.estrategia}`}</p>
                </div>
                <div className="bg-fondo p-3 rounded-md border border-estilo text-sm">
                  <p className="text-secundario">Al confirmar se aprobará la recomendación y se creará la orden de compra automáticamente en el módulo de Órdenes de Compra.</p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-estilo">
                  <Boton variante="secundario" onClick={() => setAprobarRec(null)} deshabilitado={creando}>Cancelar</Boton>
                  <Boton variante="primario" onClick={aprobarYCrear} cargando={creando}>
                    Aprobar y crear orden de compra
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-etiqueta text-secundario">Origen</p>
                    <p className="font-semibold">{obtenerNombreBotica(aprobarRec.drogueriaId || aprobarRec.boticaId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Destino</p>
                    <p className="font-semibold">{obtenerNombreBotica(aprobarRec.boticaId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Producto</p>
                    <p className="font-semibold">{obtenerNombreProducto(aprobarRec.productoId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Cantidad</p>
                    <p className="font-semibold text-lg text-marca-principal">{Math.round(aprobarRec.cantidadFinal)} uds</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-etiqueta text-secundario">Motivo</p>
                  <p className="font-semibold">{aprobarRec.motivo || `Reposición predictiva — ${aprobarRec.estrategia}`}</p>
                </div>
                <div className="bg-fondo p-3 rounded-md border border-estilo text-sm">
                  <p className="text-secundario">Al confirmar se aprobará la recomendación y se creará la transferencia automáticamente en el módulo de Transferencias.</p>
                  <p className="text-secundario mt-1">La transferencia se creará con asignación FEFO automática de lotes desde la droguería central.</p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-estilo">
                  <Boton variante="secundario" onClick={() => setAprobarRec(null)} deshabilitado={creando}>Cancelar</Boton>
                  <Boton variante="primario" onClick={aprobarYCrear} cargando={creando}>
                    Aprobar y crear transferencia
                  </Boton>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
