import { supabase } from './cliente'

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

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw new Error('Error al cargar movimientos: ' + error.message)
  return (data || []).map(MAPEAR_MOVIMIENTO)
}


