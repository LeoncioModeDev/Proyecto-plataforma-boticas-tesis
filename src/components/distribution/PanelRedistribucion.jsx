import { useState, useMemo } from 'react'
import { Lightbulb, CheckCircle, XCircle, AlertTriangle, ArrowRight, BrainCircuit, CalendarDays } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import Tabla from '@/components/common/Tabla'
import { stock } from '@/mock-data/stock'
import { productos as productosMock } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { lotes } from '@/mock-data/lotes'
import { alertas } from '@/mock-data/alertas'
import { predicciones } from '@/mock-data/predicciones'
import { clasificarAlerta } from '@/utilities/clasificarAlerta'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const DIAS_PARA_VENCIMIENTO_CRITICO = 30

function obtenerAnalisisCompleto() {
  const boticasActivas = boticas.filter(b => b.tipo === 'botica' && b.activa)
  const propuestas = []

  for (const botica of boticasActivas) {
    const stockBotica = stock.filter(s => s.ubicacionId === botica.id)
    const stockDrogueria = stock.filter(s => s.ubicacionTipo === 'drogueria')

    for (const sb of stockBotica) {
      const alerta = clasificarAlerta(sb)
      if (alerta !== 'bajo' && alerta !== 'sin_stock') continue

      const producto = productosMock.find(p => p.id === sb.productoId)
      if (!producto) continue

      const prediccion = predicciones.find(p => p.productoId === sb.productoId && p.boticaId === botica.id)
      const demandaEstimada = prediccion?.pronostico?.slice(0, 3).reduce((s, p) => s + p.predicho, 0) || 0
      const deficit = sb.stockMinimo - sb.cantidadDisponible
      const alertaML = alertas.find(a => a.productoId === sb.productoId && a.boticaId === botica.id && !a.resuelta)

      const lotesBotica = lotes.filter(l => l.ubicacionId === botica.id && l.productoId === sb.productoId && l.cantidad > 0)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
      const lotesProximoVencer = lotesBotica.filter(l => {
        const dias = Math.ceil((new Date(l.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
        return dias > 0 && dias <= DIAS_PARA_VENCIMIENTO_CRITICO
      })

      const riesgoVencimiento = lotesProximoVencer.length > 0

      const stockCentral = stockDrogueria.find(s => s.productoId === sb.productoId)
      const disponibleCentral = stockCentral ? stockCentral.cantidadDisponible - stockCentral.stockMinimo : 0
      const prioridad = alerta === 'sin_stock' ? 'alta' : riesgoVencimiento ? 'alta' : 'media'

      if (disponibleCentral >= deficit) {
        const lotesCentral = lotes.filter(l => l.ubicacionTipo === 'drogueria' && l.productoId === sb.productoId && l.cantidad > 0)
          .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))

        const lotesSugeridos = []
        let restante = deficit
        for (const lote of lotesCentral) {
          if (restante <= 0) break
          const tomar = Math.min(lote.cantidad, restante)
          lotesSugeridos.push({ loteId: lote.id, numeroLote: lote.numeroLote, cantidad: tomar, fechaVencimiento: lote.fechaVencimiento })
          restante -= tomar
        }

        propuestas.push({
          id: `prop-${propuestas.length + 1}`,
          productoId: sb.productoId,
          productoNombre: producto.nombreComercial,
          origenId: 'ub-001',
          origenNombre: 'Droguería Central',
          origenTipo: 'drogueria',
          destinoId: botica.id,
          destinoNombre: botica.nombre,
          tipo: 'transferencia',
          cantidadSugerida: deficit,
          lotesSugeridos,
          criterioFEFO: 'FIFO por fecha de vencimiento — se priorizan lotes más próximos a vencer',
          stockActual: sb.cantidadDisponible,
          stockMinimo: sb.stockMinimo,
          demandaEstimada: Math.round(demandaEstimada),
          riesgo: alerta === 'sin_stock' ? 'Sin Stock' : 'Stock Bajo',
          riesgoColor: alerta === 'sin_stock' ? 'rojo' : 'amarillo',
          prioridad,
          confianza: prediccion ? Math.round((1 - prediccion.metricas.mape / 100) * 100) : 75,
          alertaML,
          riesgoVencimiento,
          motivo: `${botica.nombre} tiene ${alerta === 'sin_stock' ? '0 unidades' : sb.cantidadDisponible + ' unidades'} de ${producto.nombreComercial} (mínimo: ${sb.stockMinimo}). La Droguería Central dispone de ${disponibleCentral} unidades. ${riesgoVencimiento ? 'Además, hay lotes próximos a vencer en esta botica.' : ''} Se sugiere transferir ${deficit} unidades aplicando criterio FEFO.`,
        })
      }

      if (disponibleCentral < deficit) {
        for (const otra of boticasActivas) {
          if (otra.id === botica.id) continue
          const stockOtra = stock.find(s => s.ubicacionId === otra.id && s.productoId === sb.productoId)
          if (!stockOtra) continue
          const alertaOtra = clasificarAlerta(stockOtra)
          if (alertaOtra !== 'sobrestock') continue
          const excedente = stockOtra.cantidadDisponible - stockOtra.stockMinimo
          if (excedente <= 0) continue

          const cantRedistribuir = Math.min(excedente, deficit)

          const lotesOtra = lotes.filter(l => l.ubicacionId === otra.id && l.productoId === sb.productoId && l.cantidad > 0)
            .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
          const lotesSugeridos = []
          let restante = cantRedistribuir
          for (const lote of lotesOtra) {
            if (restante <= 0) break
            const tomar = Math.min(lote.cantidad, restante)
            lotesSugeridos.push({ loteId: lote.id, numeroLote: lote.numeroLote, cantidad: tomar, fechaVencimiento: lote.fechaVencimiento })
            restante -= tomar
          }

          const diasVencOtra = lotesOtra.length > 0 ? Math.ceil((new Date(lotesOtra[0].fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24)) : 999
          const urgenciaVencimiento = diasVencOtra <= DIAS_PARA_VENCIMIENTO_CRITICO

          propuestas.push({
            id: `prop-${propuestas.length + 1}`,
            productoId: sb.productoId,
            productoNombre: producto.nombreComercial,
            origenId: otra.id,
            origenNombre: otra.nombre,
            origenTipo: 'botica',
            destinoId: botica.id,
            destinoNombre: botica.nombre,
            tipo: 'redistribucion',
            cantidadSugerida: cantRedistribuir,
            lotesSugeridos,
            criterioFEFO: urgenciaVencimiento
              ? 'FEFO por vencimiento próximo — se redistribuyen lotes cercanos a vencer para evitar merma'
              : 'FIFO por fecha de vencimiento — se priorizan lotes más antiguos',
            stockActual: sb.cantidadDisponible,
            stockMinimo: sb.stockMinimo,
            demandaEstimada: Math.round(demandaEstimada),
            riesgo: alerta === 'sin_stock' ? 'Sin Stock' : 'Stock Bajo',
            riesgoColor: alerta === 'sin_stock' ? 'rojo' : 'amarillo',
            prioridad: urgenciaVencimiento ? 'alta' : 'media',
            confianza: 85,
            alertaML,
            riesgoVencimiento: urgenciaVencimiento,
            motivo: `${otra.nombre} tiene excedente de ${producto.nombreComercial} (${excedente} uds). ${urgenciaVencimiento ? `Además, el lote ${lotesSugeridos[0]?.numeroLote} vence en ${diasVencOtra} días. ` : ''}Se sugiere redistribuir ${cantRedistribuir} unidades a ${botica.nombre} que tiene ${alerta === 'sin_stock' ? 'stock agotado' : 'stock bajo'}.`,
          })
        }
      }
    }
  }

  return propuestas.sort((a, b) => {
    const ordenPrioridad = { alta: 0, media: 1, baja: 2 }
    const pa = ordenPrioridad[a.prioridad] || 2
    const pb = ordenPrioridad[b.prioridad] || 2
    if (pa !== pb) return pa - pb
    const ordenRiesgo = { 'Sin Stock': 0, 'Stock Bajo': 1 }
    return (ordenRiesgo[a.riesgo] || 2) - (ordenRiesgo[b.riesgo] || 2)
  })
}

export default function PanelRedistribucion() {
  const [propuestas, setPropuestas] = useState([])
  const [modalPropuesta, setModalPropuesta] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [propuestasAceptadas, setPropuestasAceptadas] = useState(new Set())

  const productosSobrestock = useMemo(() =>
    stock.filter(s => clasificarAlerta(s) === 'sobrestock').map(s => {
      const producto = productosMock.find(p => p.id === s.productoId)
      return {
        ...s,
        nombreProducto: producto?.nombreComercial || s.productoId,
        ubicacionNombre: boticas.find(b => b.id === s.ubicacionId)?.nombre || s.ubicacionId,
        excedente: s.cantidadDisponible - s.stockMinimo,
      }
    }).filter(s => s.excedente > 0),
  [])

  const stockBajo = useMemo(() =>
    stock.filter(s => clasificarAlerta(s) === 'bajo' || clasificarAlerta(s) === 'sin_stock').map(s => {
      const producto = productosMock.find(p => p.id === s.productoId)
      const ubicacion = boticas.find(b => b.id === s.ubicacionId)
      return {
        ...s,
        nombreProducto: producto?.nombreComercial || s.productoId,
        ubicacionNombre: ubicacion?.nombre || s.ubicacionId,
        deficit: s.stockMinimo - s.cantidadDisponible,
      }
    }),
  [])

  const generarPropuestas = () => {
    const resultado = obtenerAnalisisCompleto()
    setPropuestas(resultado)
    setPropuestasAceptadas(new Set())
  }

  const aceptarPropuesta = (propuesta) => {
    if (propuestasAceptadas.has(propuesta.id)) return
    setPropuestasAceptadas(prev => new Set([...prev, propuesta.id]))
    setModalPropuesta(null)

    setMensaje({
      tipo: 'exito',
      texto: propuesta.tipo === 'transferencia'
        ? `Transferencia creada: ${propuesta.cantidadSugerida} uds de ${propuesta.productoNombre} desde ${propuesta.origenNombre} → ${propuesta.destinoNombre}`
        : `Redistribución creada: ${propuesta.cantidadSugerida} uds de ${propuesta.productoNombre} desde ${propuesta.origenNombre} → ${propuesta.destinoNombre}`
    })
    setTimeout(() => setMensaje(null), 4000)
  }

  const rechazarPropuesta = (id) => {
    setPropuestas(prev => prev.filter(p => p.id !== id))
    setPropuestasAceptadas(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setModalPropuesta(null)
    setMensaje({ tipo: 'info', texto: 'Propuesta rechazada. Se generará una alerta operativa para revisión manual.' })
    setTimeout(() => setMensaje(null), 3000)
  }

  const columnasPropuestas = [
    {
      campo: 'prioridad', encabezado: '', render: (r) => (
        <Insignia color={r.prioridad === 'alta' ? 'rojo' : 'amarillo'}>
          {r.prioridad === 'alta' ? 'Urgente' : 'Normal'}
        </Insignia>
      ),
    },
    { campo: 'productoNombre', encabezado: 'Producto', render: (r) => <span className="font-medium text-principal">{r.productoNombre}</span> },
    {
      campo: 'origenNombre', encabezado: 'Origen', render: (r) => (
        <div><span className="text-principal">{r.origenNombre}</span><br /><span className="text-etiqueta text-secundario">{r.origenTipo === 'drogueria' ? 'Droguería Central' : 'Botica'}</span></div>
      ),
    },
    {
      campo: 'destinoNombre', encabezado: 'Destino', render: (r) => (
        <div><span className="text-principal">{r.destinoNombre}</span><br /><span className="text-etiqueta text-secundario">Stock: {r.stockActual}/{r.stockMinimo}</span></div>
      ),
    },
    {
      campo: 'cantidadSugerida', encabezado: 'Cant.', render: (r) => (
        <div><span className="font-semibold text-marca-principal">{r.cantidadSugerida} uds</span><br /><span className="text-etiqueta text-secundario">{r.tipo === 'transferencia' ? 'Central →' : 'Redistribución →'}</span></div>
      ),
    },
    {
      campo: 'riesgo', encabezado: 'Riesgo', render: (r) => <Insignia color={r.riesgoColor}>{r.riesgo}</Insignia>,
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
        <span className="text-xs text-verde flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Aceptada</span>
      ) : (
        <div className="flex gap-1">
          <Boton variante="icono" icono={CheckCircle} onClick={() => aceptarPropuesta(r)} className="text-marca-principal hover:bg-marca-claro" title="Aceptar propuesta" />
          <Boton variante="icono" icono={XCircle} onClick={() => rechazarPropuesta(r.id)} className="text-estado-critico hover:bg-rojo-claro" title="Rechazar propuesta" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {mensaje && <Alerta tipo={mensaje.tipo} titulo={mensaje.texto} />}

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
                    <p className="text-xs text-secundario">{p.ubicacionNombre}</p>
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
                    <p className="text-xs text-secundario">{s.ubicacionNombre}</p>
                  </div>
                  <Insignia color="rojo">-{s.deficit} uds</Insignia>
                </div>
              ))
            )}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Propuestas Automáticas de Redistribución" descripcion="El sistema analiza stock, alertas ML, predicciones, lotes FEFO y vencimientos para generar sugerencias operativas">
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
              {productosSobrestock.length === 0 || stockBajo.length === 0
                ? 'No hay suficientes datos para generar propuestas. Se necesita al menos un producto con sobrestock y una botica con déficit del mismo producto.'
                : 'Presiona "Generar propuestas" para analizar inventario, alertas ML, predicciones y lotes FEFO.'}
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
                <Insignia color={modalPropuesta.tipo === 'transferencia' ? 'azul' : 'verde'}>
                  {modalPropuesta.tipo === 'transferencia' ? 'Transferencia Central' : 'Redistribución'}
                </Insignia>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Prioridad</p>
                <Insignia color={modalPropuesta.prioridad === 'alta' ? 'rojo' : 'amarillo'}>
                  {modalPropuesta.prioridad === 'alta' ? 'Urgente' : 'Normal'}
                </Insignia>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-fondo rounded-md">
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Origen</p>
                <p className="text-sm font-medium text-principal">{modalPropuesta.origenNombre}</p>
                <p className="text-xs text-secundario">{modalPropuesta.origenTipo === 'drogueria' ? 'Droguería Central' : 'Botica'}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-marca-principal shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Destino</p>
                <p className="text-sm font-medium text-principal">{modalPropuesta.destinoNombre}</p>
                <p className="text-xs text-secundario">Stock: {modalPropuesta.stockActual}/{modalPropuesta.stockMinimo}</p>
              </div>
            </div>

            <div className="bg-fondo rounded-md p-3">
              <p className="text-xs text-secundario mb-2 flex items-center gap-1">
                <BrainCircuit className="h-3.5 w-3.5" /> Análisis del modelo
              </p>
              <div className="grid grid-cols-3 gap-4 text-center mb-3">
                <div>
                  <p className="text-lg font-bold text-principal">{modalPropuesta.stockActual}</p>
                  <p className="text-xs text-secundario">Stock Actual</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-principal">{modalPropuesta.stockMinimo}</p>
                  <p className="text-xs text-secundario">Stock Mínimo</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-marca-principal">{modalPropuesta.demandaEstimada}</p>
                  <p className="text-xs text-secundario">Demanda Est. 3m</p>
                </div>
              </div>
              <Insignia color={modalPropuesta.confianza >= 80 ? 'verde' : modalPropuesta.confianza >= 60 ? 'amarillo' : 'rojo'}>
                {modalPropuesta.confianza}% confianza ML
              </Insignia>
            </div>

            <div className="p-3 bg-fondo rounded-md">
              <p className="text-xs text-secundario mb-2 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Criterio FEFO aplicado
              </p>
              <p className="text-sm text-principal mb-2">{modalPropuesta.criterioFEFO}</p>
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
                <Lightbulb className="h-3.5 w-3.5" /> Motivo de recomendación
              </p>
              <p className="text-sm text-principal">{modalPropuesta.motivo}</p>
              {modalPropuesta.alertaML && (
                <div className="mt-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-estado-critico" />
                  <span className="text-xs text-estado-critico">Alerta activa: {modalPropuesta.alertaML.mensaje}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" icono={XCircle} onClick={() => rechazarPropuesta(modalPropuesta.id)}>Rechazar propuesta</Boton>
              <Boton variante="primario" icono={CheckCircle} onClick={() => aceptarPropuesta(modalPropuesta)} disabled={propuestasAceptadas.has(modalPropuesta.id)}>
                Aceptar propuesta
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
