import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { serializarCSV } from '../src/utilities/exportarArchivo.js'

test('React mantiene texto y valores de edición como datos', () => {
  const valor = 'Botica <b data-auditoria="marca">R&D</b> - café'
  const literal = /Botica &lt;b data-auditoria=&quot;marca&quot;&gt;R&amp;D&lt;\/b&gt; - café/
  const tabla = createElement('table', null, createElement('tbody', null,
    createElement('tr', null, createElement('td', null, valor))))
  const edicion = createElement('input', { defaultValue: valor })
  const detalle = createElement('dd', null, valor)
  for (const elemento of [tabla, edicion, detalle]) {
    const html = renderToStaticMarkup(elemento)
    assert.match(html, literal)
    assert.doesNotMatch(html, /<b\b/)
  }
})

test('CSV escapa comillas, delimitadores y saltos sin cambiar números', () => {
  assert.equal(serializarCSV([{ nombre: 'Botica, "Central"\nSegunda línea', stock: -3 }]),
    'nombre,stock\r\n"Botica, ""Central""\nSegunda línea",-3')
})

test('CSV exporta cadenas que comienzan con prefijos de fórmula como texto', () => {
  assert.equal(serializarCSV([{ nombre: ' =marca' }, { nombre: '+marca' }, { nombre: 'A & B' }]),
    "nombre\r\n' =marca\r\n'+marca\r\nA & B")
})
