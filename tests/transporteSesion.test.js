import assert from 'node:assert/strict'
import test from 'node:test'
import { crearTransporteSesion } from '../src/services/supabase/transporteSesion.js'

const URL_PROYECTO = 'https://proyecto.example'
const REST = `${URL_PROYECTO}/rest/v1/productos?select=id`
const EDGE = `${URL_PROYECTO}/functions/v1/importaciones-datos/plantillas/ventas`
const AUTH = `${URL_PROYECTO}/auth/v1/token?grant_type=refresh_token`
const cabeceras = { Authorization: 'Bearer anterior', apikey: 'anon' }
const sesion = (access_token, id = 'A') => ({ access_token, user: { id } })
const resultado = (session) => ({ data: { session } })

function escenario(enviar) {
  const estado = { actual: sesion('anterior'), consultas: 0, renovaciones: 0 }
  const auth = {
    getSession: async () => {
      estado.consultas++
      return resultado(estado.actual)
    },
    refreshSession: async () => {
      estado.renovaciones++
      return estado.renovar ? estado.renovar() : resultado(estado.actual = sesion('nuevo'))
    },
  }
  const peticion = crearTransporteSesion({ url: URL_PROYECTO, claveAnonima: 'anon', obtenerAuth: () => auth, enviar })
  return { peticion, estado }
}

test('REST y Edge comparten una renovacion; la lectura conserva URL, opciones y cabeceras', async () => {
  const llamadas = []
  const { peticion, estado } = escenario(async (entrada, opciones) => {
    const headers = new Headers(opciones.headers)
    llamadas.push([entrada, headers.get('Authorization'), headers.get('apikey'), headers.get('Range'), opciones.credentials])
    return headers.get('Authorization') === 'Bearer nuevo' ? new Response('csv') : new Response('original', { status: 401 })
  })
  const opciones = { headers: { ...cabeceras, Range: '0-9' }, credentials: 'omit' }
  const respuestas = await Promise.all([peticion(REST, opciones), peticion(EDGE, opciones)])
  assert.equal(estado.renovaciones, 1)
  assert.deepEqual(llamadas, [
    [REST, 'Bearer anterior', 'anon', '0-9', 'omit'],
    [EDGE, 'Bearer anterior', 'anon', '0-9', 'omit'],
    [REST, 'Bearer nuevo', 'anon', '0-9', 'omit'],
    [EDGE, 'Bearer nuevo', 'anon', '0-9', 'omit'],
  ])
  assert.equal(opciones.headers.Authorization, 'Bearer anterior')
  assert.deepEqual(await Promise.all(respuestas.map((res) => res.text())), ['csv', 'csv'])
})

test('escrituras y RPC no se repiten; devuelven el 401 sin leer su cuerpo', async () => {
  for (const [url, metodo] of [[EDGE, 'POST'], [REST, 'PATCH'], [EDGE, 'PUT'], [REST, 'DELETE'], [`${URL_PROYECTO}/rest/v1/rpc/calcular`, 'GET']]) {
    let envios = 0
    const original = new Response('{"error":"original"}', { status: 401 })
    const { peticion, estado } = escenario(async () => { envios++; return original })
    assert.equal(await peticion(new Request(url, { headers: cabeceras, method: metodo })), original)
    assert.equal(envios, 1)
    assert.equal(estado.renovaciones, 1)
    assert.deepEqual(await original.json(), { error: 'original' })
  }
})

test('403, 503, credenciales anonimas y URLs fuera de alcance no consultan Auth', async () => {
  for (const [url, status, headers] of [
    [REST, 403, cabeceras], [EDGE, 503, cabeceras], [REST, 401, { Authorization: 'Bearer anon' }],
    [EDGE, 401, {}], ['https://otro.example/rest/v1/productos', 401, cabeceras],
    [`${URL_PROYECTO}/storage/v1/objeto`, 401, cabeceras], ['/fuera', 401, cabeceras],
  ]) {
    const original = new Response('original', { status })
    const { peticion, estado } = escenario(async () => original)
    assert.equal(await peticion(url, { headers }), original)
    assert.equal(estado.consultas, 0)
  }
})

test('un 401 del fetch de Auth se entrega al SDK sin recursividad', { timeout: 1000 }, async () => {
  const original = new Response('REST', { status: 401 })
  const { peticion, estado } = escenario(async (url) => url === AUTH ? new Response('Auth', { status: 401 }) : original)
  estado.renovar = async () => ({ error: await peticion(AUTH, { method: 'POST', headers: cabeceras }) })
  assert.equal(await peticion(REST, { headers: cabeceras }), original)
  assert.equal(estado.consultas, 1)
  assert.equal(estado.renovaciones, 1)
})

test('no repite lecturas con otro usuario ni cuando el token original ya no es el vigente', async () => {
  for (const momento of ['antes', 'durante', 'despues']) {
    let envios = 0
    const original = new Response('original', { status: 401 })
    const { peticion, estado } = escenario(async () => { envios++; return original })
    if (momento === 'antes') estado.actual = sesion('otro', 'B')
    estado.renovar = () => {
      estado.actual = sesion('otro', 'B')
      return resultado(momento === 'durante' ? estado.actual : sesion('nuevo'))
    }
    assert.equal(await peticion(REST, { headers: cabeceras }), original)
    assert.equal(envios, 1)
    assert.equal(estado.renovaciones, momento === 'antes' ? 0 : 1)
  }
})

test('un fallo transitorio de Auth conserva la respuesta y libera la recuperacion', async () => {
  const original = new Response('original', { status: 401 })
  const falloRed = new TypeError('sin red')
  const { peticion, estado } = escenario(async () => original)
  estado.renovar = () => { throw falloRed }
  assert.equal(await peticion(REST, { headers: cabeceras }), original)
  estado.renovar = () => ({ error: { status: 503 } })
  assert.equal(await peticion(REST, { headers: cabeceras }), original)
  assert.equal(estado.renovaciones, 2)
})

test('un segundo 401 no se renueva otra vez y una lectura abortada no se repite', async () => {
  for (const abortar of [false, true]) {
    const controlador = new AbortController()
    const primero = new Response('primero', { status: 401 })
    const segundo = new Response('segundo', { status: 401 })
    let envios = 0
    const { peticion, estado } = escenario(async () => ++envios === 1 ? primero : segundo)
    estado.renovar = () => {
      if (abortar) controlador.abort()
      return resultado(estado.actual = sesion('nuevo'))
    }
    const solicitud = new Request(EDGE, { method: 'HEAD', headers: cabeceras, signal: controlador.signal })
    assert.equal(await peticion(solicitud), abortar ? primero : segundo)
    assert.equal(envios, abortar ? 1 : 2)
    assert.equal(estado.renovaciones, 1)
  }
})
