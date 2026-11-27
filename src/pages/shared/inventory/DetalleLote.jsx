import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Insignia from '@/components/common/Insignia'
import Tabla from '@/components/common/Tabla'
import Tarjeta from '@/components/common/Tarjeta'
import { COLORES_MOVIMIENTO, ETIQUETAS_DIRECCION, ETIQUETAS_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { obtenerLotePorId, obtenerRecepcionesPorLote } from '@/services/supabase/lotes'
import { obtenerMovimientosPorLote } from '@/services/supabase/movimientos'
import useAutenticacion from '@/state/useAutenticacion'
import useAlertaVencimientoLote from '@/state/useAlertaVencimientoLote'
import { formatearFechaHora } from '@/utilities/formatearFecha'
import { clasificarVencimiento, ESTADOS_VENCIMIENTO, mostrarFechaVencimiento } from '@/utilities/vencimientoLote'

const ETIQUETAS_VENTA = { venta: 'Venta', anulacion_venta: 'Anulación de venta' }
const textoEstado = estado => estado?.replaceAll('_', ' ') || '—'

const COLUMNAS_MOVIMIENTOS = [
  { campo: 'createdAt', encabezado: 'Fecha y hora', render: (m) => formatearFechaHora(m.createdAt) },
  { campo: 'tipo', encabezado: 'Tipo', render: (m) => (
    <div className="flex items-center gap-2">
      <Insignia color={COLORES_MOVIMIENTO[m.tipo] ?? 'gris'}>{ETIQUETAS_MOVIMIENTO[m.tipo] ?? ETIQUETAS_VENTA[m.tipo] ?? m.tipo}</Insignia>
      {m.direccionAjuste ? <span>{ETIQUETAS_DIRECCION[m.direccionAjuste]}</span> : null}
    </div>
  ) },
  { campo: 'cantidad', encabezado: 'Cantidad' },
  { campo: 'nombreUbicacion', encabezado: 'Ubicación' },
  { campo: 'motivo', encabezado: 'Motivo', render: (m) => m.motivo || '—' },
  { campo: 'documento', encabezado: 'Documento', ordenable: false, render: (m) => m.documento ? `${m.documento.tipo} · ${m.documento.referencia}` : '—' },
  { campo: 'estadoDocumento', encabezado: 'Estado actual del documento', ordenable: false, render: (m) => textoEstado(m.documento?.estado) },
  { campo: 'nombreUsuario', encabezado: 'Usuario', render: (m) => m.nombreUsuario || '—' },
]

const COLUMNAS_RECEPCIONES = [
  { campo: 'fecha', encabezado: 'Fecha y hora', render: (r) => formatearFechaHora(r.fecha) },
  { campo: 'recepcion', encabezado: 'Recepción' },
  { campo: 'resultado', encabezado: 'Resultado de recepción', render: (r) => textoEstado(r.resultado) },
  { campo: 'orden', encabezado: 'Orden de compra' },
  { campo: 'estadoOrden', encabezado: 'Estado actual de la OC', render: (r) => textoEstado(r.estadoOrden) },
  { campo: 'cantidad', encabezado: 'Cantidad recibida' },
]

function ContenidoLote({ id }) {
  const { alertaDias } = useAlertaVencimientoLote()
  const [detalle, setDetalle] = useState({ estado: 'cargando' })
  const [historial, setHistorial] = useState({ estado: 'cargando' })
  const [recepciones, setRecepciones] = useState({ estado: 'cargando' })

  useEffect(() => {
    const controlador = new AbortController()
    const { signal: senal } = controlador

    async function cargar() {
      let lote
      try {
        lote = await obtenerLotePorId(id, senal)
      } catch {
        if (!senal.aborted) setDetalle({ estado: 'error' })
        return
      }

      if (senal.aborted) return
      if (!lote) {
        setDetalle({ estado: 'no_encontrado' })
        return
      }
      setDetalle({ estado: 'listo', lote })

      obtenerMovimientosPorLote(lote, senal).then(
        resultado => { if (!senal.aborted) setHistorial({ estado: 'listo', ...resultado }) },
        () => { if (!senal.aborted) setHistorial({ estado: 'error' }) },
      )
      obtenerRecepcionesPorLote(lote, senal).then(
        datos => { if (!senal.aborted) setRecepciones({ estado: 'listo', datos }) },
        () => { if (!senal.aborted) setRecepciones({ estado: 'error' }) },
      )
    }

    cargar()
    return () => controlador.abort()
  }, [id])

  if (detalle.estado === 'cargando') return <p role="status" className="text-secundario">Cargando lote...</p>
  if (detalle.estado === 'error') return <p role="alert" className="text-estado-critico">No se pudo cargar el lote.</p>
  if (detalle.estado === 'no_encontrado') return <p role="status" className="text-secundario">Lote no encontrado o no disponible para tu usuario.</p>

  const { lote } = detalle
  const { color, etiqueta } = ESTADOS_VENCIMIENTO[clasificarVencimiento(lote.fechaVencimiento, alertaDias)]
  const campos = [
    ['Producto', lote.nombreProducto],
    ['Código', lote.codigoProducto || '—'],
    ['Ubicación', lote.nombreUbicacion],
    ['Vencimiento', mostrarFechaVencimiento(lote.fechaVencimiento)],
    ['Cantidad actual', lote.cantidad],
  ]

  return (
    <>
      <Tarjeta titulo={`Lote ${lote.numeroLote}`}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Insignia color={color}>{etiqueta}</Insignia>
          {lote.cantidad === 0 ? <Insignia color="gris">Agotado</Insignia> : null}
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campos.map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dt className="text-etiqueta text-secundario">{etiqueta}</dt>
              <dd className="break-words font-medium text-principal">{valor}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <section className="space-y-3" aria-labelledby="historial-lote">
        <h2 id="historial-lote" className="text-h2 text-principal">Movimientos del lote</h2>
        <p className="text-secundario">Solo se muestran movimientos vinculados a este lote. Algunas entradas antiguas de transferencia no registraron el identificador del lote destino.</p>
        {historial.estado === 'cargando' ? <p role="status" className="text-secundario">Cargando movimientos...</p> : null}
        {historial.estado === 'error' ? <p role="alert" className="text-estado-critico">No se pudieron cargar los movimientos del lote.</p> : null}
        {historial.estado === 'listo' ? (
          <>
            {historial.errorDocumentos ? <p role="status" className="text-secundario">No se pudieron cargar todas las referencias de documentos.</p> : null}
            <Tabla columnas={COLUMNAS_MOVIMIENTOS} datos={historial.movimientos} busqueda={false} mensajeVacio="No hay movimientos vinculados disponibles para este lote." />
          </>
        ) : null}
      </section>
      <section className="space-y-3" aria-labelledby="recepciones-lote">
        <h2 id="recepciones-lote" className="text-h2 text-principal">Recepciones de órdenes de compra</h2>
        {recepciones.estado === 'cargando' ? <p role="status" className="text-secundario">Cargando recepciones...</p> : null}
        {recepciones.estado === 'error' ? <p role="alert" className="text-estado-critico">No se pudieron cargar las recepciones del lote.</p> : null}
        {recepciones.estado === 'listo' ? <Tabla columnas={COLUMNAS_RECEPCIONES} datos={recepciones.datos} busqueda={false} mensajeVacio="No hay recepciones vinculadas disponibles para este lote." /> : null}
      </section>
    </>
  )
}

export default function DetalleLote({ rutaListado, etiquetaVolver = 'Volver a lotes' }) {
  const { id } = useParams()
  const { search } = useLocation()
  const usuarioId = useAutenticacion(s => s.usuario?.id)

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link to={{ pathname: rutaListado, search }} className="inline-flex items-center gap-2 rounded px-2 py-1 font-medium text-marca-principal underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {etiquetaVolver}
        </Link>
        <h1 className="text-h1 text-principal">Detalle del lote</h1>
      </header>
      <ContenidoLote key={`${usuarioId}:${id}`} id={id} />
    </div>
  )
}
