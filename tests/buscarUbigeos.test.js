import assert from 'node:assert/strict'
import test from 'node:test'
import { buscarUbigeos } from '../src/utilities/buscarUbigeos.js'

const ate = { valor: '150103', etiqueta: 'Ate, Lima, Lima' }
const chachapoyas = { valor: '010101', etiqueta: 'Chachapoyas, Chachapoyas, Amazonas' }
const opciones = [ate, chachapoyas]

test('busca por distrito y codigo sin alterar el valor seleccionado', () => {
  for (const termino of ['Ate', 'ate', '150103', ' 150103 ']) {
    assert.deepEqual(buscarUbigeos(opciones, termino), [ate])
  }
})

test('conserva ceros y distingue prefijos de codigos inexistentes', () => {
  for (const termino of ['01', '010101']) assert.deepEqual(buscarUbigeos(opciones, termino), [chachapoyas])
  for (const termino of ['10101', '999999', '1501030']) assert.deepEqual(buscarUbigeos(opciones, termino), [])
})
