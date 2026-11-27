import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table'
import { crearFiltroPrincipios, obtenerRutaCatalogo } from './catalogoProductos.js'

test('detalle, edicion y alta resuelven el catalogo del portal activo', () => {
  for (const portal of ['central', 'operaciones']) {
    const rutaCatalogo = `/${portal}/inventario/catalogo`
    for (const segmento of ['/producto-existente', '/producto-inexistente', '/producto-existente/editar', '/nuevo']) {
      assert.equal(obtenerRutaCatalogo(`${rutaCatalogo}${segmento}`), rutaCatalogo)
    }
  }
})

const productos = [
  { id: 'combinado', principiosActivos: [
    { principioActivoId: 'a', concentracion: 500, unidadMedidaSimbolo: 'mg' },
    { principioActivoId: 'b', concentracion: 50, unidadMedidaSimbolo: 'mg' },
  ] },
  { id: 'simple', principiosActivos: [
    { principioActivoId: 'a', concentracion: '50.00', unidadMedidaSimbolo: 'mg' },
  ] },
  { id: 'decimal', principiosActivos: [
    { principioActivoId: 'a', concentracion: 2.5, unidadMedidaSimbolo: 'mg/mL' },
  ] },
  { id: 'sin-principios' },
]

const buscar = (principio, concentracion) => productos.filter(crearFiltroPrincipios(principio, concentracion)).map(p => p.id)

test('la concentracion coincide por valor exacto, con unidad opcional', () => {
  assert.deepEqual(buscar('', '50'), ['combinado', 'simple'])
  assert.deepEqual(buscar('', '500MG'), ['combinado'])
  assert.deepEqual(buscar('', ' 2,50 mg / ml '), ['decimal'])
  assert.deepEqual(buscar('', '500 g'), [])
  assert.deepEqual(buscar('', 'mg'), [])
})

test('el principio y la concentracion deben coincidir en la misma entrada', () => {
  assert.deepEqual(buscar('a', '50 mg'), ['simple'])
  assert.deepEqual(buscar('b', '50 mg'), ['combinado'])
  assert.deepEqual(buscar('a', ''), ['combinado', 'simple', 'decimal'])
})

test('limpiar ambos filtros recupera todos los productos', () => {
  assert.deepEqual(buscar('', '  '), productos.map(p => p.id))
})

test('la tabla recalcula total y paginas, y vuelve al inicio al filtrar o limpiar', async () => {
  const datos = Array.from({ length: 23 }, (_, indice) => productos[indice < 12 ? 1 : 0])
  const tabla = createTable({
    data: datos,
    columns: [],
    initialState: { pagination: { pageSize: 10 } },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onStateChange: actualizar => tabla.setOptions(opciones => ({ ...opciones, state: actualizar(opciones.state) })),
  })
  tabla.setOptions(opciones => ({ ...opciones, state: tabla.initialState }))

  assert.equal(tabla.getPageCount(), 3)
  await Promise.resolve()
  tabla.setPageIndex(2)
  assert.equal(tabla.getRowModel().rows.length, 3)

  tabla.setOptions(opciones => ({ ...opciones, data: datos.filter(crearFiltroPrincipios('a', '50 mg')) }))
  assert.equal(tabla.getFilteredRowModel().rows.length, 12)
  assert.equal(tabla.getPageCount(), 2)
  await Promise.resolve()
  assert.equal(tabla.getState().pagination.pageIndex, 0)
  assert.equal(tabla.getRowModel().rows.length, 10)

  tabla.setPageIndex(1)
  tabla.setOptions(opciones => ({ ...opciones, data: datos.filter(crearFiltroPrincipios('', '')) }))
  assert.equal(tabla.getFilteredRowModel().rows.length, 23)
  assert.equal(tabla.getPageCount(), 3)
  await Promise.resolve()
  assert.equal(tabla.getState().pagination.pageIndex, 0)
})
