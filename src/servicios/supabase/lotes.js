import { lotes as lotesMock } from '@/datos-prueba/lotes'
import { diasRestantes } from '@/utilidades/formatearFecha'

const LATENCIA = 300

export async function obtenerLotesActivos(productoId) {
  await new Promise(r => setTimeout(r, LATENCIA))
  let resultado = lotesMock.filter(l => l.cantidad > 0)
  if (productoId) resultado = resultado.filter(l => l.productoId === productoId)
  return resultado
}

export async function crearLote(datos) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const nuevo = { ...datos, id: `lot-${Date.now()}`, fechaIngreso: new Date().toISOString() }
  console.log('[Mock] Lote creado:', nuevo)
  return nuevo
}

export async function obtenerLotesProximosAVencer(dias = 90) {
  await new Promise(r => setTimeout(r, LATENCIA))
  return lotesMock.filter(l => {
    const restantes = diasRestantes(l.fechaVencimiento)
    return restantes > 0 && restantes <= dias
  })
}
