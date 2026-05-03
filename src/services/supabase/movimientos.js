import { movimientos as movimientosMock } from '@/mock-data/movimientos'

const LATENCIA = 300

export async function obtenerMovimientos(filtros = {}) {
  await new Promise(r => setTimeout(r, LATENCIA))
  let resultado = [...movimientosMock]
  if (filtros.tipo) resultado = resultado.filter(m => m.tipo === filtros.tipo)
  if (filtros.productoId) resultado = resultado.filter(m => m.productoId === filtros.productoId)
  if (filtros.ubicacionId) resultado = resultado.filter(m => m.ubicacionId === filtros.ubicacionId)
  return resultado.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))
}

export async function registrarMovimiento(datos) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const nuevo = { ...datos, id: `mov-${Date.now()}`, fechaHora: new Date().toISOString() }
  console.log('[Mock] Movimiento registrado:', nuevo)
  return nuevo
}
