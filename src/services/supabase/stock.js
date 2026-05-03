import { stock as stockMock } from '@/mock-data/stock'

const LATENCIA = 300

export async function obtenerStockPorUbicacion(ubicacionId) {
  await new Promise(r => setTimeout(r, LATENCIA))
  if (!ubicacionId) return stockMock
  return stockMock.filter(s => s.ubicacionId === ubicacionId)
}

export async function obtenerStockProducto(productoId) {
  await new Promise(r => setTimeout(r, LATENCIA))
  return stockMock.filter(s => s.productoId === productoId)
}

export async function actualizarStockMinimo(stockId, valor) {
  await new Promise(r => setTimeout(r, LATENCIA))
  console.log('[Mock] Stock mínimo actualizado:', stockId, valor)
  return { id: stockId, stockMinimo: valor }
}
