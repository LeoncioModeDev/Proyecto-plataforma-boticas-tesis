import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Insignia from '@/components/common/Insignia'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import Modal from '@/components/common/Modal'
import BarraFiltros from '@/components/common/BarraFiltros'
import CampoBusqueda from '@/components/common/CampoBusqueda'
import SelectFiltro from '@/components/common/SelectFiltro'
import useAlertas from '@/state/useAlertas'
import { ETIQUETAS_ALERTA, COLORES_ALERTA } from '@/constants/tiposAlerta'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'
import { AlertTriangle, TrendingUp, Clock, BrainCircuit, Loader2 } from 'lucide-react'
import { evaluarAlertas, resolverAlertaML } from '@/services/ml-model/alertasML'

const ICONOS = {
  quiebre: AlertTriangle,
  stock_bajo: AlertTriangle,
  stock_critico: AlertTriangle,
  riesgo_desabastecimiento: BrainCircuit,
  riesgo_stock_seguridad: BrainCircuit,
  sobrestock: TrendingUp,
  vencimiento: Clock,
  prediccion: BrainCircuit,
}

function etiquetaTipo(alerta) {
  if (alerta.metadata?.tipo_ml_original === 'reposicion_recomendada') return 'Reposición recomendada'
  if (alerta.metadata?.tipo_ml_original === 'compra_urgente') return 'Compra urgente'
  return ETIQUETAS_ALERTA[alerta.tipo] || alerta.tipo || 'Alerta'
}

function colorTipo(alerta) {
  return COLORES_ALERTA[alerta.tipo] || 'gris'
}

function colorUrgencia(urgencia) {
  const valor = String(urgencia || '').toLowerCase()
  if (valor === 'critica' || valor === 'alta') return 'rojo'
  if (valor === 'media') return 'amarillo'
  return 'gris'
}

function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—'
}

function CampoAlerta({ etiqueta, valor }) {
  if (valor === undefined || valor === null || valor === '') return null
  return (
    <div className="rounded-md bg-fondo px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-secundario">{etiqueta}</p>
      <p className="text-sm font-semibold text-principal">{valor}</p>
    </div>
  )
}

function camposPorTipo(alerta) {
  const meta = alerta.metadata || {}
  const tipoOriginal = meta.tipo_ml_original
  if (alerta.tipo === 'vencimiento') {
    return [
      ['Producto', alerta.nombreProducto],
      ['Botica', alerta.nombreBotica],
      ['Lote', alerta.referenciaNombre || meta.numero_lote],
      ['Cantidad del lote', meta.cantidad_lote != null ? `${formatearNumero(meta.cantidad_lote)} uds` : null],
      ['Fecha de vencimiento', alerta.fechaVencimiento],
      ['Días restantes', meta.dias_vencimiento],
    ]
  }
  if (alerta.tipo === 'sobrestock') {
    return [
      ['Producto', alerta.nombreProducto],
      ['Botica', alerta.nombreBotica],
      ['Stock físico', meta.stock_fisico != null ? formatearNumero(meta.stock_fisico) : formatearNumero(alerta.stockActual)],
      ['Stock máximo', meta.stock_maximo != null ? formatearNumero(meta.stock_maximo) : null],
      ['Exceso estimado', meta.exceso_estimado != null ? formatearNumero(meta.exceso_estimado) : null],
    ]
  }
  if (alerta.tipo === 'riesgo_desabastecimiento') {
    return [
      ['Producto', alerta.nombreProducto],
      ['Botica', alerta.nombreBotica],
      ['Stock disponible', meta.stock_disponible != null ? formatearNumero(meta.stock_disponible) : formatearNumero(alerta.stockActual)],
      ['Stock proyectado', formatearNumero(alerta.stockProyectado)],
      ['Demanda pronosticada', meta.demanda_pronosticada != null ? `${formatearNumero(meta.demanda_pronosticada)} uds` : null],
      ['Necesidad estimada', meta.cantidad_necesaria != null ? `${formatearNumero(meta.cantidad_necesaria)} uds` : alerta.cantidadRecomendada != null ? `${formatearNumero(alerta.cantidadRecomendada)} uds` : null],
      ['Cantidad transferible', meta.cantidad_transferible != null ? `${formatearNumero(meta.cantidad_transferible)} uds` : null],
    ]
  }
  if (tipoOriginal === 'reposicion_recomendada') {
    return [
      ['Producto', alerta.nombreProducto],
      ['Botica', alerta.nombreBotica],
      ['Stock disponible', meta.stock_disponible != null ? formatearNumero(meta.stock_disponible) : formatearNumero(alerta.stockActual)],
      ['Stock proyectado', formatearNumero(alerta.stockProyectado)],
      ['Necesidad estimada', meta.cantidad_necesaria != null ? `${formatearNumero(meta.cantidad_necesaria)} uds` : alerta.cantidadRecomendada != null ? `${formatearNumero(alerta.cantidadRecomendada)} uds` : null],
      ['Cantidad transferible', meta.cantidad_transferible != null ? `${formatearNumero(meta.cantidad_transferible)} uds` : null],
    ]
  }
  return [
    ['Producto', alerta.nombreProducto],
    ['Botica', alerta.nombreBotica],
    ['Stock actual', formatearNumero(alerta.stockActual)],
    ['Stock mínimo', meta.stock_minimo != null ? formatearNumero(meta.stock_minimo) : null],
  ]
}

function obtenerReferenciaLegible(alerta) {
  const meta = alerta.metadata || {}
  if (!alerta.referenciaTipo) return null
  if (alerta.referenciaTipo === 'lotes' || meta.numero_lote) return `Lote ${alerta.referenciaNombre || meta.numero_lote || 'sin número'}`
  if (alerta.referenciaTipo === 'recomendaciones_ml') return 'Recomendación predictiva'
  return alerta.referenciaTipo
}

function tipoRecomendacionDesdeAlerta(alerta) {
  const tipoOriginal = alerta.metadata?.tipo_ml_original
  if (tipoOriginal === 'reposicion_recomendada') return 'REPOSICION_INTERNA'
  if (tipoOriginal === 'compra_urgente') return 'COMPRA'
  return 'TODOS'
}

function construirParametrosOperacion(alerta) {
  const meta = alerta.metadata || {}
  const parametros = new URLSearchParams()
  if (alerta.productoId) parametros.set('productoId', alerta.productoId)
  if (alerta.boticaId) parametros.set('boticaId', alerta.boticaId)
  if (meta.numero_lote) parametros.set('lote', meta.numero_lote)
  if (meta.cantidad_transferible != null) parametros.set('cantidad', String(Math.round(Number(meta.cantidad_transferible))))
  if (alerta.cantidadRecomendada != null && !parametros.has('cantidad')) parametros.set('cantidad', String(Math.round(Number(alerta.cantidadRecomendada))))
  const query = parametros.toString()
  return query ? `?${query}` : ''
}

function obtenerAccionOperativa(alerta) {
  const meta = alerta.metadata || {}
  const tipoOriginal = meta.tipo_ml_original
  const cantidadTransferible = Number(meta.cantidad_transferible ?? 0)
  const parametros = construirParametrosOperacion(alerta)

  if (alerta.referenciaTipo === 'recomendaciones_ml' && alerta.referenciaId) {
    return { etiqueta: 'Revisar recomendación', tipo: 'recomendacion' }
  }

  if (tipoOriginal === 'compra_urgente') {
    return { etiqueta: 'Crear orden de compra', ruta: `/central/proveedores/ordenes/nueva${parametros}` }
  }

  if (alerta.tipo === 'vencimiento') {
    return { etiqueta: 'Redistribuir lote', ruta: `/central/distribucion/redistribucion${parametros}` }
  }

  if (alerta.tipo === 'sobrestock') {
    return { etiqueta: 'Redistribuir stock', ruta: `/central/distribucion/redistribucion${parametros}` }
  }

  if (tipoOriginal === 'reposicion_recomendada' || alerta.tipo === 'riesgo_desabastecimiento' || alerta.tipo === 'stock_bajo') {
    if (cantidadTransferible > 0) return { etiqueta: 'Crear transferencia', ruta: `/central/distribucion/transferencias/nueva${parametros}` }
    return { etiqueta: 'Crear orden de compra', ruta: `/central/proveedores/ordenes/nueva${parametros}` }
  }

  if (alerta.tipo === 'quiebre' || alerta.tipo === 'stock_critico') {
    return { etiqueta: 'Crear transferencia', ruta: `/central/distribucion/transferencias/nueva${parametros}` }
  }

  return { etiqueta: 'Ver producto', tipo: 'producto' }
}

export default function PaginaAlertas() {
  const navegar = useNavigate()
  const { alertas, cargando, error, cargarAlertas } = useAlertas()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroOrigen, setFiltroOrigen] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [filtroUrgencia, setFiltroUrgencia] = useState('TODOS')
  const [alertaResolver, setAlertaResolver] = useState(null)
  const [comentarioResolucion, setComentarioResolucion] = useState('')

  useEffect(() => { cargarAlertas() }, [cargarAlertas])

  const alertasFiltradas = alertas.filter(alerta => {
    const termino = busqueda.trim().toLowerCase()
    const matchBusqueda = termino
      ? [alerta.nombreProducto, alerta.nombreBotica, alerta.mensaje, alerta.referenciaNombre, alerta.metadata?.numero_lote].some(valor => String(valor || '').toLowerCase().includes(termino))
      : true
    const matchOrigen = filtroOrigen === 'TODOS' || alerta.tipoOrigen === filtroOrigen
    const matchTipo = filtroTipo === 'TODOS' || alerta.tipo === filtroTipo || alerta.metadata?.tipo_ml_original === filtroTipo
    const matchUrgencia = filtroUrgencia === 'TODOS' || String(alerta.urgencia || '').toLowerCase() === filtroUrgencia
    return matchBusqueda && matchOrigen && matchTipo && matchUrgencia
  })
  const alertasReglas = alertasFiltradas.filter(a => a.tipoOrigen === 'regla')
  const alertasPredictivas = alertasFiltradas.filter(a => a.tipoOrigen === 'modelo')

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroOrigen('TODOS')
    setFiltroTipo('TODOS')
    setFiltroUrgencia('TODOS')
  }

  const irAProducto = (alerta) => {
    if (!alerta.productoId) return
    navegar(`/central/inventario/catalogo?productoId=${encodeURIComponent(alerta.productoId)}`)
  }

  const irARecomendacion = (alerta) => {
    const parametros = new URLSearchParams()
    const tipoRecomendacion = tipoRecomendacionDesdeAlerta(alerta)
    if (alerta.productoId) parametros.set('productoId', alerta.productoId)
    if (alerta.boticaId && tipoRecomendacion !== 'COMPRA') parametros.set('boticaId', alerta.boticaId)
    parametros.set('tipo', tipoRecomendacion)
    parametros.set('estado', alerta.referenciaId ? 'TODOS' : 'PENDIENTE')
    if (alerta.referenciaId) parametros.set('recomendacionId', alerta.referenciaId)
    navegar(`/ml/recomendaciones?${parametros.toString()}`)
  }

  const ejecutarAccionOperativa = (alerta, accion) => {
    if (accion.tipo === 'recomendacion') return irARecomendacion(alerta)
    if (accion.tipo === 'producto') return irAProducto(alerta)
    navegar(accion.ruta)
  }

  const opcionesOrigen = [
    { valor: 'TODOS', etiqueta: 'Todos los orígenes' },
    { valor: 'regla', etiqueta: 'Reglas' },
    { valor: 'modelo', etiqueta: 'Predictivas' },
  ]
  const opcionesTipo = [
    { valor: 'TODOS', etiqueta: 'Todos los tipos' },
    { valor: 'riesgo_desabastecimiento', etiqueta: 'Riesgo de desabastecimiento' },
    { valor: 'sobrestock', etiqueta: 'Sobrestock' },
    { valor: 'vencimiento', etiqueta: 'Próximo vencimiento' },
    { valor: 'reposicion_recomendada', etiqueta: 'Reposición recomendada' },
    { valor: 'compra_urgente', etiqueta: 'Compra urgente' },
  ]
  const opcionesUrgencia = [
    { valor: 'TODOS', etiqueta: 'Todas las urgencias' },
    { valor: 'critica', etiqueta: 'Crítica' },
    { valor: 'alta', etiqueta: 'Alta' },
    { valor: 'media', etiqueta: 'Media' },
    { valor: 'baja', etiqueta: 'Baja' },
  ]

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-marca-principal" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-estado-critico mb-4" />
        <p className="text-cuerpo text-estado-critico">Error al cargar alertas</p>
        <p className="text-sm text-secundario mt-1">{error}</p>
        <button onClick={cargarAlertas} className="mt-4 text-sm text-marca-principal hover:underline">Reintentar</button>
      </div>
    )
  }

  const confirmarResolucion = async () => {
    if (!alertaResolver) return
    setProcesando(true)
    try {
      await resolverAlertaML(alertaResolver.id, comentarioResolucion.trim())
      await cargarAlertas()
      setMensaje('Alerta resuelta correctamente')
      setAlertaResolver(null)
      setComentarioResolucion('')
    } catch (err) {
      setMensaje(err.message)
    } finally {
      setProcesando(false)
    }
  }

  const cerrarModalResolucion = () => {
    if (procesando) return
    setAlertaResolver(null)
    setComentarioResolucion('')
  }

  const renderAlerta = (alerta) => {
    const Icono = ICONOS[alerta.tipo] || AlertTriangle
    const accionOperativa = obtenerAccionOperativa(alerta)
    return (
      <div key={alerta.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-fondo-secundario border border-estilo rounded-lg hover:border-marca-principal transition-colors">
        <div className="p-2 bg-fondo rounded-lg shrink-0">
          <Icono className="h-5 w-5 text-secundario" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Insignia color={colorTipo(alerta)}>{etiquetaTipo(alerta)}</Insignia>
            <Insignia color={colorUrgencia(alerta.urgencia)}>{alerta.urgencia}</Insignia>
            <Insignia color={alerta.tipoOrigen === 'modelo' ? 'azul' : 'gris'}>{alerta.tipoOrigen === 'modelo' ? 'Predictiva' : 'Regla'}</Insignia>
          </div>
          <p className="text-sm text-principal">{alerta.mensaje}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {camposPorTipo(alerta).map(([etiqueta, valor]) => <CampoAlerta key={etiqueta} etiqueta={etiqueta} valor={valor} />)}
          </div>
          <div className="text-xs text-secundario mt-2 space-y-1">
            <p>{formatearFechaRelativa(alerta.fechaCreacion)}</p>
            {obtenerReferenciaLegible(alerta) && <p>Referencia: {obtenerReferenciaLegible(alerta)}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="pequeno" onClick={() => ejecutarAccionOperativa(alerta, accionOperativa)}>{accionOperativa.etiqueta}</Boton>
            {accionOperativa.tipo !== 'recomendacion' && alerta.referenciaTipo === 'recomendaciones_ml' && alerta.referenciaId && <button type="button" className="text-xs text-marca-principal hover:underline" onClick={() => irARecomendacion(alerta)}>Ir a recomendación</button>}
            {accionOperativa.tipo !== 'producto' && alerta.productoId && <button type="button" className="text-xs text-marca-principal hover:underline" onClick={() => irAProducto(alerta)}>Ir a producto</button>}
            <button type="button" onClick={() => setAlertaResolver(alerta)} disabled={procesando} className="text-xs text-estado-exito hover:underline disabled:opacity-60">Marcar resuelta</button>
          </div>
        </div>
      </div>
    )
  }

  const evaluarAhora = async () => {
    setProcesando(true)
    setMensaje(null)
    try {
      const resultado = await evaluarAlertas()
      await cargarAlertas()
      const pares = resultado?.pares_evaluados ?? 0
      const alertasActualizadas = resultado?.alertas_guardadas ?? resultado?.alertas_generadas ?? 0
      setMensaje(`Evaluación completada: ${pares} combinación(es) revisadas, ${alertasActualizadas} alerta(s) actualizadas`)
    } catch (err) {
      setMensaje(err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-h1 text-principal font-semibold">Alertas Predictivas</h1>
          <p className="text-secundario mt-1">{alertasFiltradas.length} alertas encontradas</p>
        </div>
        <Boton onClick={evaluarAhora} cargando={procesando}>{procesando ? 'Evaluando alertas...' : 'Evaluar alertas ahora'}</Boton>
      </div>
      {mensaje && <Alerta tipo="exito" titulo={mensaje} alCerrar={() => setMensaje(null)} />}
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar producto, botica o lote..." className="w-full sm:w-72" />
        <SelectFiltro valor={filtroOrigen} alCambiar={setFiltroOrigen} opciones={opcionesOrigen} placeholder="Todos los orígenes" />
        <SelectFiltro valor={filtroTipo} alCambiar={setFiltroTipo} opciones={opcionesTipo} placeholder="Todos los tipos" />
        <SelectFiltro valor={filtroUrgencia} alCambiar={setFiltroUrgencia} opciones={opcionesUrgencia} placeholder="Todas las urgencias" />
      </BarraFiltros>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas por Reglas ({alertasReglas.length})</h2>
          {alertasReglas.length === 0 && <p className="text-secundario text-sm">Sin alertas por reglas</p>}
          {alertasReglas.map(renderAlerta)}
        </div>
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-h3 text-principal font-medium">Alertas Predictivas ({alertasPredictivas.length})</h2>
          {alertasPredictivas.length === 0 && <p className="text-secundario text-sm">Sin alertas predictivas</p>}
          {alertasPredictivas.map(renderAlerta)}
        </div>
      </div>
      <Modal abierto={!!alertaResolver} alCerrar={cerrarModalResolucion} titulo="Resolver alerta" tamano="md">
        {alertaResolver && (
          <div className="space-y-4">
            <div className="rounded-lg border border-estilo bg-fondo p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Insignia color={colorTipo(alertaResolver)}>{etiquetaTipo(alertaResolver)}</Insignia>
                <Insignia color={colorUrgencia(alertaResolver.urgencia)}>{alertaResolver.urgencia}</Insignia>
              </div>
              <p className="text-sm text-principal">{alertaResolver.mensaje}</p>
              <p className="mt-2 text-xs text-secundario">{alertaResolver.nombreProducto} · {alertaResolver.nombreBotica}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Comentario de resolución</label>
              <textarea
                value={comentarioResolucion}
                onChange={e => setComentarioResolucion(e.target.value)}
                placeholder="Describe brevemente la acción tomada..."
                rows={3}
                className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" onClick={cerrarModalResolucion} deshabilitado={procesando}>Cancelar</Boton>
              <Boton variante="primario" onClick={confirmarResolucion} cargando={procesando}>Confirmar resolución</Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
