import { transferencias as transferenciasMock } from '@/datos-prueba/transferencias'

const LATENCIA = 300

export async function obtenerTransferencias(estado) {
  await new Promise(r => setTimeout(r, LATENCIA))
  if (!estado) return transferenciasMock
  return transferenciasMock.filter(t => t.estado === estado)
}

export async function crearTransferencia(datos) {
  await new Promise(r => setTimeout(r, LATENCIA))
  const nueva = { ...datos, id: `tr-${Date.now()}`, estado: 'pendiente', fechaCreacion: new Date().toISOString() }
  console.log('[Mock] Transferencia creada:', nueva)
  return nueva
}

export async function confirmarRecepcion(transferenciaId) {
  await new Promise(r => setTimeout(r, LATENCIA))
  console.log('[Mock] Recepción confirmada:', transferenciaId)
  return { id: transferenciaId, estado: 'completada', fechaRecepcion: new Date().toISOString() }
}
