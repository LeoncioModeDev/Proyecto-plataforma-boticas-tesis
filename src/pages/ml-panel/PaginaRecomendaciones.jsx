import { useState } from 'react'
import { CheckCircle, XCircle, MapPin, BrainCircuit, Truck, ArrowRight, Eye } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import { stock } from '@/mock-data/stock'
import { productos as productosMock } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { predicciones } from '@/mock-data/predicciones'
import { clasificarAlerta } from '@/utilities/clasificarAlerta'

const TIPOS_RECOMENDACION = {
  transferencia: { etiqueta: 'Transferencia Central', color: 'azul', icono: Truck },
  redistribucion: { etiqueta: 'Redistribución', color: 'verde', icono: ArrowRight },
}

function generarRecomendaciones() {
  const recs = []
  const boticasActivas = boticas.filter(b => b.tipo === 'botica' && b.activa)

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

      const stockCentral = stockDrogueria.find(s => s.productoId === sb.productoId)
      const disponibleCentral = stockCentral ? stockCentral.cantidadDisponible - stockCentral.stockMinimo : 0

      if (disponibleCentral >= deficit) {
        recs.push({
          id: `rec-${recs.length + 1}`,
          productoId: sb.productoId,
          productoNombre: producto.nombreComercial,
          boticaId: botica.id,
          boticaNombre: botica.nombre,
          riesgo: alerta === 'sin_stock' ? 'Sin Stock' : 'Stock Bajo',
          riesgoColor: alerta === 'sin_stock' ? 'rojo' : 'amarillo',
          stockActual: sb.cantidadDisponible,
          stockMinimo: sb.stockMinimo,
          demandaEstimada: Math.round(demandaEstimada),
          origenSugerido: 'Droguería Central',
          origenId: 'ub-001',
          origenTipo: 'drogueria',
          tipo: 'transferencia',
          cantidadSugerida: deficit,
          confianza: prediccion ? Math.round((1 - prediccion.metricas.mape / 100) * 100) : 75,
          motivo: `La ${botica.nombre} tiene ${alerta === 'sin_stock' ? '0 unidades' : sb.cantidadDisponible + ' unidades'} de ${producto.nombreComercial} (mínimo: ${sb.stockMinimo}). La Droguería Central tiene ${disponibleCentral} unidades disponibles. Se sugiere transferir ${deficit} unidades.`,
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
          recs.push({
            id: `rec-${recs.length + 1}`,
            productoId: sb.productoId,
            productoNombre: producto.nombreComercial,
            boticaId: botica.id,
            boticaNombre: botica.nombre,
            riesgo: alerta === 'sin_stock' ? 'Sin Stock' : 'Stock Bajo',
            riesgoColor: alerta === 'sin_stock' ? 'rojo' : 'amarillo',
            stockActual: sb.cantidadDisponible,
            stockMinimo: sb.stockMinimo,
            demandaEstimada: Math.round(demandaEstimada),
            origenSugerido: `${otra.nombre}`,
            origenId: otra.id,
            origenTipo: 'botica',
            tipo: 'redistribucion',
            cantidadSugerida: cantRedistribuir,
            confianza: 85,
            motivo: `La ${otra.nombre} tiene excedente de ${producto.nombreComercial} (${excedente} uds disponibles). Se sugiere redistribuir ${cantRedistribuir} unidades a ${botica.nombre} que tiene ${alerta === 'sin_stock' ? 'stock agotado' : 'stock bajo'}.`,
          })
        }
      }
    }
  }

  return recs.sort((a, b) => {
    const ordenRiesgo = { 'Sin Stock': 0, 'Stock Bajo': 1 }
    return (ordenRiesgo[a.riesgo] || 2) - (ordenRiesgo[b.riesgo] || 2)
  })
}

export default function PaginaRecomendaciones() {
  const [recomendaciones, setRecomendaciones] = useState(() => generarRecomendaciones())
  const [detalleRec, setDetalleRec] = useState(null)
  const [ejecutada, setEjecutada] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  const pendientes = recomendaciones.filter(r => r.estado === 'pendiente' || !r.estado).length

  const confirmar = (id) => {
    setRecomendaciones(prev => prev.map(r =>
      r.id === id ? { ...r, estado: 'confirmada' } : r
    ))
    setEjecutada(recomendaciones.find(r => r.id === id))
    setDetalleRec(null)
  }

  const rechazar = (id) => {
    setRecomendaciones(prev => prev.map(r =>
      r.id === id ? { ...r, estado: 'rechazada' } : r
    ))
    setMensaje({ tipo: 'info', texto: 'Recomendación rechazada. Se generará una alerta operativa manual.' })
    setTimeout(() => setMensaje(null), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-principal">Recomendaciones Operativas ML</h1>
          <p className="text-secundario mt-1">
            El modelo analiza stock, demanda estimada y disponibilidad para sugerir transferencias y redistribuciones
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-secundario">Recomendaciones activas</p>
          <p className="text-h3 text-marca-principal">{pendientes}</p>
        </div>
      </div>

      {mensaje && <Alerta tipo={mensaje.tipo} titulo={mensaje.texto} />}

      {recomendaciones.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CheckCircle className="h-12 w-12 text-marca-principal mb-3" />
          <p className="text-h3 text-principal">No hay recomendaciones pendientes</p>
          <p className="text-secundario mt-1">Todas las boticas tienen inventario dentro de parámetros normales.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recomendaciones.map(rec => {
            const tipoCfg = TIPOS_RECOMENDACION[rec.tipo] || TIPOS_RECOMENDACION.transferencia
            const IconoTipo = tipoCfg.icono
            const estaPendiente = !rec.estado || rec.estado === 'pendiente'

            return (
              <Tarjeta key={rec.id} className={rec.estado === 'confirmada' ? 'opacity-70' : rec.estado === 'rechazada' ? 'opacity-50' : ''}>
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-h3 text-principal">{rec.productoNombre}</h3>
                      <Insignia color={rec.riesgoColor}>{rec.riesgo}</Insignia>
                      <Insignia color={tipoCfg.color}>
                        <IconoTipo className="h-3 w-3 mr-1" />{tipoCfg.etiqueta}
                      </Insignia>
                      {rec.estado === 'confirmada' && <Insignia color="verde"><CheckCircle className="h-3 w-3 mr-1" />Confirmada</Insignia>}
                      {rec.estado === 'rechazada' && <Insignia color="rojo"><XCircle className="h-3 w-3 mr-1" />Rechazada</Insignia>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-etiqueta text-secundario">Botica afectada</p>
                        <p className="flex items-center gap-1 text-principal mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-secundario" />{rec.boticaNombre}
                        </p>
                      </div>
                      <div>
                        <p className="text-etiqueta text-secundario">Stock actual</p>
                        <p className="font-medium text-principal mt-0.5">{rec.stockActual} uds</p>
                      </div>
                      <div>
                        <p className="text-etiqueta text-secundario">Stock mínimo</p>
                        <p className="font-medium text-principal mt-0.5">{rec.stockMinimo} uds</p>
                      </div>
                      <div>
                        <p className="text-etiqueta text-secundario">Demanda estimada (3 meses)</p>
                        <p className="font-medium text-principal mt-0.5">{rec.demandaEstimada} uds</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-sm">
                      <BrainCircuit className="h-3.5 w-3.5 text-secundario" />
                      <span className="text-secundario">Origen sugerido:</span>
                      <span className="font-medium text-principal">{rec.origenSugerido}</span>
                      <ArrowRight className="h-3 w-3 text-secundario mx-1" />
                      <span className="font-medium text-principal">{rec.boticaNombre}</span>
                      <span className="mx-2 text-secundario">|</span>
                      <span className="font-semibold text-marca-principal">{rec.cantidadSugerida} uds</span>
                      <span className="mx-2 text-secundario">|</span>
                      <Insignia color={rec.confianza >= 80 ? 'verde' : rec.confianza >= 60 ? 'amarillo' : 'rojo'}>
                        {rec.confianza}% confianza
                      </Insignia>
                    </div>
                  </div>

                  {estaPendiente && (
                    <div className="flex lg:flex-col gap-2 shrink-0 lg:justify-center">
                      <Boton variante="primario" tamaňo="sm" icono={CheckCircle} onClick={() => confirmar(rec.id)}>
                        Confirmar
                      </Boton>
                      <Boton variante="secundario" tamaňo="sm" icono={XCircle} onClick={() => rechazar(rec.id)}>
                        Rechazar
                      </Boton>
                      <Boton variante="texto" tamaňo="sm" icono={Eye} onClick={() => setDetalleRec(rec)}>
                        Ver detalle
                      </Boton>
                    </div>
                  )}
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      <Modal abierto={!!detalleRec} alCerrar={() => setDetalleRec(null)} titulo="Detalle de Recomendación ML" tamano="lg">
        {detalleRec && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Producto</p>
                <p className="text-sm font-medium text-principal">{detalleRec.productoNombre}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Tipo</p>
                <Insignia color={(TIPOS_RECOMENDACION[detalleRec.tipo] || TIPOS_RECOMENDACION.transferencia).color}>
                  {(TIPOS_RECOMENDACION[detalleRec.tipo] || TIPOS_RECOMENDACION.transferencia).etiqueta}
                </Insignia>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Botica afectada</p>
                <p className="text-sm text-principal">{detalleRec.boticaNombre}</p>
              </div>
              <div className="p-3 bg-fondo rounded-md">
                <p className="text-xs text-secundario mb-1">Riesgo detectado</p>
                <Insignia color={detalleRec.riesgoColor}>{detalleRec.riesgo}</Insignia>
              </div>
            </div>

            <div className="bg-fondo rounded-md p-3">
              <p className="text-xs text-secundario mb-2">Análisis de inventario</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-principal">{detalleRec.stockActual}</p>
                  <p className="text-xs text-secundario">Stock Actual</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-principal">{detalleRec.stockMinimo}</p>
                  <p className="text-xs text-secundario">Stock Mínimo</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-marca-principal">{detalleRec.demandaEstimada}</p>
                  <p className="text-xs text-secundario">Demanda Est. 3m</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-fondo rounded-md">
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Origen</p>
                <p className="text-sm font-medium text-principal">{detalleRec.origenSugerido}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-marca-principal shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-secundario">Destino</p>
                <p className="text-sm font-medium text-principal">{detalleRec.boticaNombre}</p>
              </div>
              <div className="border-l border-estilo pl-3">
                <p className="text-xs text-secundario">Cantidad</p>
                <p className="text-lg font-bold text-marca-principal">{detalleRec.cantidadSugerida} uds</p>
              </div>
            </div>

            <div className="p-3 bg-estado-info-fondo rounded-md">
              <p className="text-xs text-secundario mb-1 flex items-center gap-1">
                <BrainCircuit className="h-3.5 w-3.5" /> Análisis del modelo
              </p>
              <p className="text-sm text-principal">{detalleRec.motivo}</p>
              <p className="text-xs text-secundario mt-2">
                Confianza del modelo: {detalleRec.confianza}% |
                Stock origen: {detalleRec.origenTipo === 'drogueria'
                  ? stock.find(s => s.ubicacionTipo === 'drogueria' && s.productoId === detalleRec.productoId)?.cantidadDisponible || 0
                  : stock.find(s => s.ubicacionId === detalleRec.origenId && s.productoId === detalleRec.productoId)?.cantidadDisponible || 0} uds
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
              <Boton variante="secundario" icono={XCircle} onClick={() => { rechazar(detalleRec.id); setDetalleRec(null) }}>Rechazar</Boton>
              <Boton variante="primario" icono={CheckCircle} onClick={() => confirmar(detalleRec.id)}>Confirmar recomendación</Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={!!ejecutada} alCerrar={() => setEjecutada(null)} titulo="Recomendación Confirmada" tamano="md">
        {ejecutada && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle className="h-12 w-12 text-marca-principal mb-3" />
              <p className="text-h3 text-principal">Recomendación confirmada</p>
              <p className="text-secundario mt-1">
                Se ha creado automáticamente una {ejecutada.tipo === 'transferencia' ? 'transferencia' : 'redistribución'}.
              </p>
            </div>
            <div className="p-3 bg-fondo rounded-md">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-etiqueta text-secundario">Producto</p>
                  <p className="font-medium text-principal">{ejecutada.productoNombre}</p>
                </div>
                <div>
                  <p className="text-etiqueta text-secundario">Tipo</p>
                  <p className="font-medium text-principal">{ejecutada.tipo === 'transferencia' ? 'Transferencia Central' : 'Redistribución'}</p>
                </div>
                <div>
                  <p className="text-etiqueta text-secundario">Origen</p>
                  <p className="font-medium text-principal">{ejecutada.origenSugerido}</p>
                </div>
                <div>
                  <p className="text-etiqueta text-secundario">Destino</p>
                  <p className="font-medium text-principal">{ejecutada.boticaNombre}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-etiqueta text-secundario">Cantidad</p>
                  <p className="text-lg font-bold text-marca-principal">{ejecutada.cantidadSugerida} unidades</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <Boton variante="primario" onClick={() => setEjecutada(null)}>Cerrar</Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
