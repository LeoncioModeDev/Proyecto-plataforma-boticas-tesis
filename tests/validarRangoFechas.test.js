import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validarRangoFechas } from '../supabase/functions/_shared/validarRangoFechas.js'

test('históricos: permite omitir uno o ambos límites', () => {
  assert.equal(validarRangoFechas('', ''), null)
  assert.equal(validarRangoFechas('2024-02-29', null), null)
  assert.equal(validarRangoFechas(undefined, '2024-02-29'), null)
})

test('históricos: acepta fechas iguales y distingue un rango invertido', () => {
  assert.equal(validarRangoFechas('2024-02-29', '2024-02-29'), null)
  assert.equal(validarRangoFechas('2024-02-29', '2024-03-01'), null)
  assert.match(validarRangoFechas('2024-03-01', '2024-02-29'), /inicial.*posterior/)
})

test('históricos: rechaza fechas inexistentes o con formato distinto de AAAA-MM-DD', () => {
  for (const fecha of ['2025-02-29', '2024-04-31', '2024-13-01', '0000-01-01', '2024-2-01', '2024-02-01T00:00', '2024-02-01\n']) {
    assert.match(validarRangoFechas(fecha, ''), /inicial/)
    assert.match(validarRangoFechas('', fecha), /final/)
  }
})

test('movimientos: admite límites abiertos o iguales y ordena también por hora', () => {
  const desde = '2024-02-29T09:00'
  const hasta = '2024-02-29T18:00'
  assert.equal(validarRangoFechas('', '', 'datetime-local'), null)
  assert.equal(validarRangoFechas(desde, '', 'datetime-local'), null)
  assert.equal(validarRangoFechas('', hasta, 'datetime-local'), null)
  assert.equal(validarRangoFechas(desde, desde, 'datetime-local'), null)
  assert.equal(validarRangoFechas(desde, hasta, 'datetime-local'), null)
  assert.match(validarRangoFechas(hasta, desde, 'datetime-local'), /inicial.*posterior/)
})

test('movimientos: rechaza día inválido, hora inválida y sufijo de zona horaria', () => {
  for (const fecha of ['2025-02-29T09:00', '2024-02-29T24:00', '2024-02-29T10:60', '2024-02-29T09:00Z']) {
    assert.match(validarRangoFechas(fecha, '', 'datetime-local'), /inicial/)
    assert.match(validarRangoFechas('', fecha, 'datetime-local'), /final/)
  }
})
