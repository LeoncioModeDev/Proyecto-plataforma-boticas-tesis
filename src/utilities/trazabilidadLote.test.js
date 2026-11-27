import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { documentoDelMovimiento, esMovimientoDelLote } from './trazabilidadLote.js'

const origen = { id: 'a0000000-0000-4000-8000-000000000001', ubicacionTipo: 'drogueria', ubicacionId: null }
const destino = { id: 'a0000000-0000-4000-8000-000000000002', ubicacionTipo: 'botica', ubicacionId: 'botica-1' }
const entrada = { lote_id: destino.id, producto_id: 'producto-1', tipo_movimiento: 'entrada', transferencia_id: 'trf-1', ubicacion_tipo: 'botica', ubicacion_id: destino.ubicacionId }
const transferencia = { id: 'trf-1', numero_transferencia: 'TRF-000001', estado: 'recibida', origen_tipo: 'drogueria', origen_id: null, destino_tipo: 'botica', destino_id: destino.ubicacionId }

test('una entrada antigua con UUID origen no se atribuye a ninguno de los lotes', () => {
  const antigua = { ...entrada, lote_id: origen.id }
  assert.equal(esMovimientoDelLote(antigua, origen), false)
  assert.equal(esMovimientoDelLote(antigua, destino), false)
  assert.equal(esMovimientoDelLote(entrada, destino), true)
  assert.equal(esMovimientoDelLote(entrada, origen), false)
})

test('transferencia solo por ID visible y extremo compatible con el movimiento', () => {
  const documentos = new Map([[transferencia.id, transferencia]])
  assert.deepEqual(documentoDelMovimiento(entrada, new Map(), documentos), { tipo: 'Transferencia', referencia: 'TRF-000001', estado: 'recibida' })
  assert.equal(documentoDelMovimiento({ ...entrada, transferencia_id: 'otra' }, new Map(), documentos), null)
  assert.equal(documentoDelMovimiento({ ...entrada, ubicacion_id: 'otra' }, new Map(), documentos), null)
  const salida = { ...entrada, lote_id: origen.id, tipo_movimiento: 'salida', ubicacion_tipo: 'drogueria', ubicacion_id: null }
  assert.equal(esMovimientoDelLote(salida, origen), true)
  assert.equal(documentoDelMovimiento(salida, new Map(), documentos)?.referencia, 'TRF-000001')
})

test('venta y anulación muestran la venta visible del mismo ID y botica, sin inferirla del motivo', () => {
  const venta = { id: 'venta-1', botica_id: destino.ubicacionId, numero_venta: 'VTA-00000001', estado: 'anulada' }
  const documentos = new Map([[venta.id, venta]])
  for (const tipo of ['venta', 'anulacion_venta']) {
    const movimiento = { lote_id: destino.id, tipo_movimiento: tipo, ubicacion_id: destino.ubicacionId, venta_id: venta.id, motivo: 'Venta VTA-00000001' }
    assert.deepEqual(documentoDelMovimiento(movimiento, documentos, new Map()), { tipo: 'Venta', referencia: 'VTA-00000001', estado: 'anulada' })
    assert.equal(documentoDelMovimiento(movimiento, new Map(), new Map()), null)
    assert.equal(documentoDelMovimiento({ ...movimiento, venta_id: null }, documentos, new Map()), null)
    assert.equal(documentoDelMovimiento({ ...movimiento, ubicacion_id: 'otra' }, documentos, new Map()), null)
  }
})
