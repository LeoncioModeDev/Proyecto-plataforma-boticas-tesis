import { mlFetch } from './clienteML'

export function obtenerMadurezSerie(boticaId, productoId, options = {}) {
  return mlFetch(`/series/${boticaId}/${productoId}/madurez`, { method: 'GET', signal: options.signal })
}

export function generarPrediccion(payload, options = {}) {
  return mlFetch('/predicciones', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
  })
}

export function generarPrediccionesBotica(payload, options = {}) {
  return mlFetch('/predicciones/botica', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
  })
}

export function obtenerPrediccionesML({ boticaId, productoId }, options = {}) {
  if (!boticaId || !productoId) return Promise.resolve({ predicciones: [] })
  return mlFetch(`/predicciones/${boticaId}/${productoId}`, { method: 'GET', signal: options.signal })
}
