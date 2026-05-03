import { productos as productosMock } from '@/mock-data/productos'

/**
 * Servicio de productos — funciones mock que simulan llamadas a Supabase.
 */

const LATENCIA = 300

export async function obtenerProductos() {
  await new Promise(r => setTimeout(r, LATENCIA))
  return productosMock
}

export async function obtenerProductoPorId(id) {
  await new Promise(r => setTimeout(r, LATENCIA))
  return productosMock.find(p => p.id === id) || null
}

export async function crearProducto(datos) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const nuevo = { ...datos, id: `prod-${Date.now()}`, fechaCreacion: new Date().toISOString() }
  console.log('[Mock] Producto creado:', nuevo)
  return nuevo
}

export async function actualizarProducto(id, datos) {
  await new Promise(r => setTimeout(r, LATENCIA))
  console.log('[Mock] Producto actualizado:', id, datos)
  return { id, ...datos }
}

export async function desactivarProducto(id) {
  await new Promise(r => setTimeout(r, LATENCIA))
  console.log('[Mock] Producto desactivado:', id)
  return { id, estado: 'inactivo' }
}
