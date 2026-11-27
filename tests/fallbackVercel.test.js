import assert from 'node:assert/strict'
import { test } from 'node:test'
import config from '../vercel.json' with { type: 'json' }

function destinoFallback(url) {
  const { pathname } = new URL(url, 'https://app.example')
  // Esta regla de Vercel usa un grupo regex, sin parametros de ruta nombrados.
  return config.rewrites.find(({ source }) => new RegExp(`^${source}$`).test(pathname))?.destination
}

test('envia a React los enlaces directos, las rutas dinamicas y las rutas desconocidas', () => {
  for (const ruta of [
    '/',
    '/iniciar-sesion',
    '/restablecer-contrasena?token=ejemplo',
    '/central/dashboard',
    '/central/inventario/catalogo/ab120bc9-1084-440a-931e-504c99f70cbf',
    '/operaciones/inventario/catalogo/123/editar/?volver=catalogo.json',
    '/operaciones/inventario/catalogo/sku.v2/editar',
    '/botica/stock/123',
    '/admin-saas/organizaciones/123/editar',
    '/ruta-inexistente',
    '/central/ruta-inexistente',
    '/apiarios/123',
    '/assets-internos/123',
  ]) {
    assert.equal(destinoFallback(ruta), '/index.html', ruta)
  }
})

test('no usa el HTML de la SPA como respaldo de API ni de archivos, aunque no existan', () => {
  for (const ruta of [
    '/api',
    '/api/',
    '/api/v1/inexistente',
    '/ml-api',
    '/ml-api/health',
    '/.well-known/inexistente',
    '/assets',
    '/assets/',
    '/assets/inexistente',
    '/assets/app-inexistente.js?v=1',
    '/favicon.svg',
    '/icons.svg',
    '/favicon-inexistente.ico',
    '/central/inventario/inexistente.css',
    '/docs/inexistente.pdf/',
    '/index.html',
  ]) {
    assert.equal(destinoFallback(ruta), undefined, ruta)
  }
})
