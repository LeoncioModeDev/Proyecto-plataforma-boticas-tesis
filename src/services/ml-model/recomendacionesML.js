import { mlFetch } from './clienteML'

export function obtenerRecomendaciones(options = {}) {
  return mlFetch('/recomendaciones', { method: 'GET', signal: options.signal })
}

export function generarRecomendacionCompra(payload, options = {}) {
  return mlFetch('/recomendaciones/compra', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
  })
}

export function generarRecomendacionReposicion(payload, options = {}) {
  return mlFetch('/recomendaciones/reposicion', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
  })
}

export function aprobarRecomendacion(id, options = {}) {
  return mlFetch(`/recomendaciones/${id}/aprobar`, { method: 'POST', signal: options.signal })
}

export function rechazarRecomendacion(id, _motivo, options = {}) {
  return mlFetch(`/recomendaciones/${id}/rechazar`, { method: 'POST', signal: options.signal })
}
