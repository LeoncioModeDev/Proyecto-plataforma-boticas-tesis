import { supabase } from './cliente'

import { documentoDelMovimiento, esMovimientoDelLote } from '@/utilities/trazabilidadLote'

const MAPEAR_MOVIMIENTO = (item) => ({
  id: item.id,
  tipo: item.tipo_movimiento,
  productoId: item.producto_id,
  loteId: item.lote_id,
  ubicacionTipo: item.ubicacion_tipo,
  ubicacionId: item.ubicacion_id,
  cantidad: item.cantidad,
  direccionAjuste: item.direccion_ajuste || null,
  motivo: item.motivo,
  usuarioId: item.usuario_id,
  transferenciaId: item.transferencia_id,
  createdAt: item.created_at,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  codigoProducto: item.productos?.codigo_interno || null,
  nombreUbicacion: item.boticas?.nombre || item.ubicacion_id || 'Droguería Central',
  nombreUsuario: item.usuarios?.nombre || item.usuario_id,
})

const SELECCION = `
  id,
  tipo_movimiento,
  producto_id,
  lote_id,
  ubicacion_tipo,
  ubicacion_id,
  cantidad,
  direccion_ajuste,
  motivo,
  usuario_id,
  transferencia_id,
  created_at,
  productos:producto_id (nombre_comercial, codigo_interno),
  boticas:ubicacion_id (nombre),
  usuarios:usuario_id (nombre)
`

export async function obtenerMovimientosPorLote(lote, senal) {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select(`${SELECCION}, venta_id`)
    .eq('lote_id', lote.id)
    .eq('org_id', lote.orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .abortSignal(senal)

  if (error) throw new Error('Error al cargar movimientos: ' + error.message)
  const filas = (data || []).filter(movimiento => esMovimientoDelLote(movimiento, lote))

  async function cargarDocumentos(tabla, campo, seleccion) {
    const ids = [...new Set(filas.map(movimiento => movimiento[campo]).filter(Boolean))]
    const documentos = new Map()
    // Limitar la longitud de las URLs de PostgREST para historiales con muchas referencias.
    for (let inicio = 0; inicio < ids.length; inicio += 100) {
      const { data, error } = await supabase.from(tabla).select(seleccion)
        .eq('org_id', lote.orgId).in('id', ids.slice(inicio, inicio + 100)).abortSignal(senal)
      if (error) throw error
      for (const documento of data || []) documentos.set(documento.id, documento)
    }
    return documentos
  }

  // transferencia_id no tiene FK en movimientos; resolver ambos documentos por su ID bajo RLS.
  const [ventas, transferencias] = await Promise.allSettled([
    cargarDocumentos('ventas', 'venta_id', 'id, numero_venta, estado, botica_id'),
    cargarDocumentos('transferencias', 'transferencia_id', 'id, numero_transferencia, estado, origen_tipo, origen_id, destino_tipo, destino_id'),
  ])
  const sinDocumentos = new Map()
  return {
    movimientos: filas.map(fila => ({
      ...MAPEAR_MOVIMIENTO(fila),
      documento: documentoDelMovimiento(fila, ventas.value ?? sinDocumentos, transferencias.value ?? sinDocumentos),
    })),
    errorDocumentos: ventas.status === 'rejected' || transferencias.status === 'rejected',
  }
}

export async function obtenerMovimientos(filtros = {}) {
  let query = supabase
    .from('movimientos_inventario')
    .select(SELECCION)

  if (filtros.tipo) {
    query = query.eq('tipo_movimiento', filtros.tipo)
  }
  if (filtros.productoId) {
    query = query.eq('producto_id', filtros.productoId)
  }
  if (filtros.ubicacionId) {
    query = query.eq('ubicacion_id', filtros.ubicacionId)
  }

  query = query.order('created_at', { ascending: false })

  if (filtros.limite) {
    query = query.limit(filtros.limite)
  }

  const { data, error } = await query

  if (error) throw new Error('Error al cargar movimientos: ' + error.message)
  return (data || []).map(MAPEAR_MOVIMIENTO)
}


