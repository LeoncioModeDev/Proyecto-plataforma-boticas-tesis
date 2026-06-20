import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, CheckCircle, XCircle, AlertTriangle, ArrowRight, CalendarDays, ExternalLink } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import Tabla from '@/components/common/Tabla'
import useAutenticacion from '@/state/useAutenticacion'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerStockPorUbicacion } from '@/services/supabase/stock'
import { obtenerTransferencias, crearRedistribucion, obtenerLotesParaRedistribucion } from '@/services/supabase/transferencias'
import { clasificarAlerta } from '@/utilities/clasificarAlerta'
import { formatearFechaCorta } from '@/utilities/formatearFecha'
import { obtenerPortal } from '@/utilities/permisos'

export default function PanelRedistribucion() {
  const { usuario } = useAutenticacion()

  const [boticas, setBoticas] = useState([])
  const [stock, setStock] = useState([])
  const [lotes, setLotes] = useState([])
  const [lotesComprometidos, setLotesComprometidos] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [propuestas, setPropuestas] = useState([])
  const [propuestasIntentadas, setPropuestasIntentadas] = useState(false)
  const [propuestasAceptadas, setPropuestasAceptadas] = useState(new Set())
  const [procesando, setProcesando] = useState(null)
  const [modalPropuesta, setModalPropuesta] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    if (!usuario) return
    cargarDatos()
  }, [usuario])

  async function cargarDatos() {
    try {
      setCargando(true)
      setError(null)

      const [boticasData, stockData, lotesData, transferenciasData] = await Promise.all([
        listarBoticas({ activas: true }),
        obtenerStockPorUbicacion(),
        obtenerLotesParaRedistribucion(),
        obtenerTransferencias(),
      ])

      const soloBoticas = boticasData.filter(b => b.tipo === 'botica')
      const idsBoticas = new Set(soloBoticas.map(b => b.id))

      setBoticas(soloBoticas)
      setStock(stockData.filter(s => idsBoticas.has(s.ubicacionId)))
      setLotes(lotesData.filter(l => idsBoticas.has(l.ubicacionId)))

      const estadosActivos = new Set(['creada', 'en_transito', 'pendiente_devolucion'])
      const comprometidos = new Set()
      for (const t of transferenciasData) {
        if (estadosActivos.has(t.estado)) {
          for (const item of t.items || []) {
            if (item.loteId) comprometidos.add(item.loteId)
          }
        }
      }
      setLotesComprometidos(comprometidos)

      if (!soloBoticas.length) {
        setError('No hay boticas activas en tu organización')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const productosSobrestock = useMemo(() => {
    if (!stock.length || !boticas.length) return []
    return stock
      .filter(s => clasificarAlerta(s) === 'sobrestock')
      .map(s => {
        const botica = boticas.find(b => b.id === s.ubicacionId)
        const excedente = s.stockMaximo != null ? s.cantidadDisponible - s.stockMaximo : 0
        return { ...s, nombreUbicacion: botica?.nombre || s.ubicacionId, excedente }
      })
      .filter(s => s.excedente > 0)
  }, [stock, boticas])

  const stockBajo = useMemo(() => {
    if (!stock.length || !boticas.length) return []
    return stock
      .filter(s => {
        const alerta = clasificarAlerta(s)
        return alerta === 'bajo' || alerta === 'sin_stock'
      })
      .map(s => {
        const botica = boticas.find(b => b.id === s.ubicacionId)
        return {
          ...s,
          nombreUbicacion: botica?.nombre || s.ubicacionId,
          deficit: s.stockMinimo - s.cantidadDisponible,
          sinStock: s.cantidadDisponible === 0,
        }
      })
  }, [stock, boticas])

  function generarPropuestas() {
    const resultado = []

    for (const destino of stockBajo) {
      const productoId = destino.productoId
      const deficit = destino.deficit

      for (const origen of productosSobrestock) {
        if (origen.ubicacionId === destino.ubicacionId) continue
        if (origen.productoId !== productoId) continue

        const excedente = origen.excedente
        if (excedente <= 0) continue

        const lotesDisponibles = lotes
          .filter(l =>
            l.productoId === productoId &&
            l.ubicacionId === origen.ubicacionId &&
            l.cantidad > 0 &&
            !lotesComprometidos.has(l.id)
          )
          .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))

        if (!lotesDisponibles.length) continue

        const lotesSugeridos = []
        let restante = Math.min(deficit, excedente)

        for (const lote of lotesDisponibles) {
          if (restante <= 0) break
          const tomar = Math.min(lote.cantidad, restante)
          lotesSugeridos.push({
            loteId: lote.id,
            numeroLote: lote.numeroLote,
            cantidad: tomar,
            fechaVencimiento: lote.fechaVencimiento,
          })
          restante -= tomar
        }

        if (!lotesSugeridos.length) continue

        const cantidadSugerida = lotesSugeridos.reduce((s, l) => s + l.cantidad, 0)
        if (cantidadSugerida <= 0) continue

        const prioridad = destino.sinStock ? 'urgente' : 'alta'
        const riesgo = destino.sinStock ? 'Sin Stock' : 'Stock Bajo'
        const riesgoColor = destino.sinStock ? 'rojo' : 'amarillo'

        resultado.push({
          id: `prop-${resultado.length + 1}`,
          productoId,
          productoNombre: destino.nombreProducto || origen.nombreProducto,
          origenId: origen.ubicacionId,
          origenNombre: origen.nombreUbicacion,
          destinoId: destino.ubicacionId,
          destinoNombre: destino.nombreUbicacion,
          cantidadSugerida,
          lotesSugeridos,
          stockOrigen: origen.cantidadDisponible,
          stockDestino: destino.cantidadDisponible,
          stockMinimo: destino.stockMinimo,
          stockMaximo: origen.stockMaximo,
          excedente,
          deficit,
          tipo: 'redistribucion',
          prioridad,
          riesgo,
          riesgoColor,
          regla: `${destino.nombreUbicacion} tiene ${destino.sinStock ? 'stock agotado' : `stock bajo (${destino.cantidadDisponible}/${destino.stockMinimo})`}. ${origen.nombreUbicacion} tiene excedente de ${excedente} uds (${origen.cantidadDisponible}/${origen.stockMaximo}). Se sugiere redistribuir ${cantidadSugerida} uds aplicando criterio FEFO.`,
        })

        break
      }
    }

    resultado.sort((a, b) => {
      const ordenPrioridad = { urgente: 0, alta: 1, normal: 2 }
      if (a.prioridad !== b.prioridad) {
        return ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad]
      }
      if (a.deficit !== b.deficit) return b.deficit - a.deficit
      const aVence = a.lotesSugeridos[0]?.fechaVencimiento || '9999-12-31'
      const bVence = b.lotesSugeridos[0]?.fechaVencimiento || '9999-12-31'
      if (aVence !== bVence) return new Date(aVence) - new Date(bVence)
      return b.excedente - a.excedente
    })

    setPropuestas(resultado)
    setPropuestasIntentadas(true)
    setPropuestasAceptadas(new Set())

    if (resultado.length === 0) {
      setMensaje({
        tipo: 'info',
        texto: 'No se encontraron propuestas. Verifica que las boticas tengan configurados stock mínimo y stock máximo, y que exista al menos una botica con sobrestock y otra con déficit para el mismo producto.',
      })
      setTimeout(() => setMensaje(null), 6000)
    }
  }

  async function aceptarPropuesta(propuesta) {
    if (propuestasAceptadas.has(propuesta.id)) return
    try {
      setProcesando(propuesta.id)
      await crearRedistribucion({
        tipo_transferencia: 'redistribucion',
        origen_id: propuesta.origenId,
        destino_id: propuesta.destinoId,
        items: propuesta.lotesSugeridos.map(l => ({
          producto_id: propuesta.productoId,
          lote_id: l.loteId,
          cantidad: l.cantidad,
        })),
      })
      setPropuestasAceptadas(prev => new Set([...prev, propuesta.id]))
      setModalPropuesta(null)
      setMensaje({
        tipo: 'exito',
        texto: `Redistribución creada: ${propuesta.cantidadSugerida} uds de ${propuesta.productoNombre} desde ${propuesta.origenNombre} → ${propuesta.destinoNombre}`,
        enlace: { ruta: `/${obtenerPortal(usuario)}/distribucion/transferencias`, texto: 'Ver transferencias' },
      })
      setTimeout(() => setMensaje(null), 6000)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `Error al crear redistribución: ${e.message}` })
      setTimeout(() => setMensaje(null), 5000)
    } finally {
      setProcesando(null)
    }
  }

  function rechazarPropuesta(id) {
    setPropuestas(prev => prev.filter(p => p.id !== id))
    setPropuestasAceptadas(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setModalPropuesta(null)
    setMensaje({ tipo: 'info', texto: 'Propuesta descartada.' })
    setTimeout(() => setMensaje(null), 3000)
  }

  const prioridadLabel = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal' }
  const prioridadColor = { urgente: 'rojo', alta: 'naranja', normal: 'amarillo' }

  const columnasPropuestas = [
    {
      campo: 'prioridad', encabezado: '', render: (r) => (
        <Insignia color={prioridadColor[r.prioridad]}>{prioridadLabel[r.prioridad]}</Insignia>
      ),
    },
    { campo: 'productoNombre', encabezado: 'Producto', render: (r) => <span className="font-medium text-principal">{r.productoNombre}</span> },
    {
      campo: 'origenNombre', encabezado: 'Origen', render: (r) => (
        <div>
          <span className="text-principal">{r.origenNombre}</span>
          <br />
          <span className="text-etiqueta text-secundario">Stock: {r.stockOrigen} / Máx: {r.stockMaximo}</span>
        </div>
      ),
    },
    {
      campo: 'destinoNombre', encabezado: 'Destino', render: (r) => (
        <div>
          <span className="text-principal">{r.destinoNombre}</span>
          <br />
          <span className="text-etiqueta text-secundario">Stock: {r.stockDestino} / Mín: {r.stockMinimo}</span>
        </div>
      ),
    },
    {
      campo: 'cantidadSugerida', encabezado: 'Cant.', render: (r) => (
        <div>
          <span className="font-semibold text-marca-principal">{r.cantidadSugerida} uds</span>
          <br />
          <span className="text-etiqueta text-secundario">Redistribución →</span>
        </div>
      ),
    },
    {
      campo: 'riesgo', encabezado: '', render: (r) => <Insignia color={r.riesgoColor}>{r.riesgo}</Insignia>,
    },
    {
      campo: 'lotes', encabezado: 'Lotes FEFO', render: (r) => (
        <button onClick={() => setModalPropuesta(r)} className="text-marca-principal hover:underline text-sm flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" /> {r.lotesSugeridos.length} lote{r.lotesSugeridos.length !== 1 ? 's' : ''}
        </button>
      ),
    },
    {
      campo: 'acciones', encabezado: '',
      render: (r) => propuestasAceptadas.has(r.id) ? (
        <span className="text-xs text-verde flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Creada</span>
      ) : (
        <div className="flex gap-1">
          <Boton variante="icono" icono={CheckCircle} onClick={() => aceptarPropuesta(r)} cargando={procesando === r.id} className="text-marca-principal hover:bg-marca-claro" title="Crear redistribución" />
          <Boton variante="icono" icono={XCircle} onClick={() => rechazarPropuesta(r.id)} className="text-estado-critico hover:bg-rojo-claro" title="Descartar propuesta" />
        </div>
      ),
    },
  ]

  if (cargando) {
    return <div className="flex items-center justify-center py-16"><p className="text-secundario">Cargando datos de inventario...</p></div>
  }

  if (error && !boticas.length) {
    return (
      <div className="space-y-4">
        <Alerta tipo="error" titulo={error} />
        <Boton variante="secundario" onClick={cargarDatos}>Reintentar</Boton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {mensaje && (
        <div className="space-y-2">
          <Alerta tipo={mensaje.tipo} titulo={mensaje.texto} />
          {mensaje.enlace && (
            <Link to={mensaje.enlace.ruta} className="inline-flex items-center gap-1 text-sm text-marca-principal hover:underline ml-1">
              {mensaje.enlace.texto} <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Productos con Excedente" descripcion="Disponibles para redistribuir desde boticas con sobrestock">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {productosSobrestock.length === 0 ? (
              <p className="text-secundario text-sm">No hay productos con excedente</p>
            ) : (
              productosSobrestock.map(p => (
                <div key={`${p.ubicacionId}-${p.productoId}`} className="flex items-center justify-between p-2.5 bg-fondo rounded-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-principal truncate">{p.nombreProducto}</p>
                    <p className="text-xs text-secundario">{p.nombreUbicacion}</p>
                  </div>
                  <Insignia color="azul">+{p.excedente} uds</Insignia>
                </div>
              ))
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Boticas con Déficit" descripcion="Requieren reposición (stock bajo o sin stock)">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stockBajo.length === 0 ? (
              <p className="text-secundario text-sm">Ninguna botica presenta déficit</p>
            ) : (
              stockBajo.map(s => (
                <div key={`${s.ubicacionId}-${s.productoId}`} className="flex items-center justify-between p-2.5 bg-fondo rounded-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-principal truncate">{s.nombreProducto}</p>
                    <p className="text-xs text-secundario">{s.nombreUbicacion}</p>
                  </div>
                  <Insignia color="rojo">-{s.deficit} uds</Insignia>
                </div>
              ))
            )}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Propuestas Automáticas de Redistribución" descripcion="El sistema analiza el stock real de las boticas y sugiere redistribuciones según reglas de déficit y sobrestock">
        <div className="flex items-center gap-4 mb-4">
          <Boton variante="primario" icono={Lightbulb} onClick={generarPropuestas} disabled={productosSobrestock.length === 0 || stockBajo.length === 0}>
            Generar propuestas de redistribución
          </Boton>
          {propuestas.length > 0 && (
            <span className="text-sm text-secundario">{propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''} generada{propuestas.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {propuestas.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-secundario mb-3" />
            <p className="text-secundario">
              {!propuestasIntentadas
                ? 'Presiona "Generar propuestas" para analizar inventario, stock mínimo/máximo y lotes FEFO.'
                : 'No se encontraron propuestas de redistribución. Verifica que las boticas tengan configurados stock mínimo y stock máximo, y que exista al menos una botica con sobrestock y otra con déficit para el mismo producto.'}
            </p>
          </div>
        )}

        {propuestas.length > 0 && (
          <Tabla columnas={columnasPropuestas} datos={propuestas} />
        )}
      </Tarjeta>

      <Modal abierto={!!modalPropuesta} alCerrar={() => setModalPropuesta(null)} titulo="Detalle de Propuesta" tamano="lg">
        {modalPropuesta && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Producto</p>
                <p className="text-sm font-medium text-principal">{modalPropuesta.productoNombre}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Cantidad Sugerida</p>
                <p className="text-lg font-bold text-marca-principal">{modalPropuesta.cantidadSugerida} uds</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Tipo</p>
                <Insignia color="verde">Redistribución</Insignia>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Prioridad</p>
                <Insignia color={prioridadColor[modalPropuesta.prioridad]}>
                  {prioridadLabel[modalPropuesta.prioridad]}
                </Insignia>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-fondo rounded-md">
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Origen</p>
                <p className="text-sm font-medium text-principal">{modalPropuesta.origenNombre}</p>
                <p className="text-xs text-secundario">Stock: {modalPropuesta.stockOrigen} / Máx: {modalPropuesta.stockMaximo}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-marca-principal shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Destino</p>
                <p className="text-sm font-medium text-principal">{modalPropuesta.destinoNombre}</p>
                <p className="text-xs text-secundario">Stock: {modalPropuesta.stockDestino} / Mín: {modalPropuesta.stockMinimo}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Excedente en origen</p>
                <p className="text-lg font-bold text-azul">{modalPropuesta.excedente} uds</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Déficit en destino</p>
                <p className="text-lg font-bold text-estado-critico">{modalPropuesta.deficit} uds</p>
              </div>
            </div>

            <div className="p-3 bg-fondo rounded-md">
              <p className="text-xs text-secundario mb-2 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Criterio FEFO aplicado
              </p>
              <p className="text-sm text-principal mb-2">Lotes ordenados por fecha de vencimiento (FEFO) — se priorizan lotes más próximos a vencer</p>
              <div className="space-y-1.5">
                {modalPropuesta.lotesSugeridos.map((lote, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 bg-fondo-secundario rounded border border-estilo">
                    <span className="font-mono text-secundario">{lote.numeroLote}</span>
                    <span className="text-secundario">Vence: {formatearFechaCorta(lote.fechaVencimiento)}</span>
                    <span className="font-medium text-marca-principal">{lote.cantidad} uds</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-estado-info-fondo rounded-md">
              <p className="text-xs text-secundario mb-1 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5" /> Regla aplicada
              </p>
              <p className="text-sm text-principal">{modalPropuesta.regla}</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" icono={XCircle} onClick={() => rechazarPropuesta(modalPropuesta.id)}>Descartar propuesta</Boton>
              <Boton variante="primario" icono={CheckCircle} onClick={() => aceptarPropuesta(modalPropuesta)} disabled={propuestasAceptadas.has(modalPropuesta.id)} cargando={procesando === modalPropuesta.id}>
                Crear redistribución
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
