export function esMovimientoDelLote(movimiento, lote) {
  if (movimiento.lote_id !== lote.id) return false
  // Las entradas históricas que guardaron el UUID origen no pertenecen a su ubicación.
  if (movimiento.tipo_movimiento === 'entrada' && movimiento.transferencia_id) {
    return movimiento.ubicacion_tipo === lote.ubicacionTipo && movimiento.ubicacion_id === lote.ubicacionId
  }
  return true
}

export function documentoDelMovimiento(movimiento, ventas, transferencias) {
  const venta = ventas.get(movimiento.venta_id)
  if (venta && venta.botica_id === movimiento.ubicacion_id) {
    return { tipo: 'Venta', referencia: venta.numero_venta || venta.id, estado: venta.estado }
  }

  const transferencia = transferencias.get(movimiento.transferencia_id)
  if (transferencia) {
    const extremo = movimiento.tipo_movimiento === 'entrada' ? 'destino' : 'origen'
    if (transferencia[`${extremo}_tipo`] === movimiento.ubicacion_tipo && transferencia[`${extremo}_id`] === movimiento.ubicacion_id) {
      return { tipo: 'Transferencia', referencia: transferencia.numero_transferencia || transferencia.id, estado: transferencia.estado }
    }
  }
  return null
}
