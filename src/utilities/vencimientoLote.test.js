import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { clasificarVencimiento, fechaNegocioLotes, mostrarFechaVencimiento } from './vencimientoLote.js'

test('cambia de día a medianoche UTC y el lote es válido durante su fecha de vencimiento', () => {
  const fecha = '2026-04-30'
  const antes = fechaNegocioLotes(new Date('2026-04-30T23:59:59.999Z'))
  const despues = fechaNegocioLotes(new Date('2026-04-30T19:00:00-05:00'))
  assert.equal(clasificarVencimiento(fecha, 5, antes), 'proximo')
  assert.equal(clasificarVencimiento(fecha, 5, despues), 'vencido')
})

test('el umbral configurado es inclusivo y no se adivina si no está disponible', () => {
  const hoy = '2026-01-30'
  assert.equal(clasificarVencimiento('2026-02-02', 3, hoy), 'proximo')
  assert.equal(clasificarVencimiento('2026-02-02', 2, hoy), 'vigente')
  assert.equal(clasificarVencimiento(hoy, undefined, hoy), 'sin_umbral')
  assert.equal(clasificarVencimiento('2026-01-29', undefined, hoy), 'vencido')
})

test('rechaza fechas ausentes o imposibles y conserva el día del calendario al mostrarlo', () => {
  for (const fecha of [null, '', '2026-02-29', '2026-04-31', '2026-02-01T00:00:00Z']) {
    assert.equal(clasificarVencimiento(fecha, 3, '2026-01-30'), 'sin_fecha')
    assert.equal(mostrarFechaVencimiento(fecha), '—')
  }
  assert.equal(mostrarFechaVencimiento('2028-02-29'), '29/02/2028')
})
