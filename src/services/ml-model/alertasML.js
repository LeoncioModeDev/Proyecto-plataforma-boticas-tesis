import { mlFetch } from './clienteML'

export function evaluarAlertas(options = {}) {
  const body = options.filtros ? JSON.stringify(options.filtros) : undefined
  return mlFetch('/alertas/evaluar', { method: 'POST', body, signal: options.signal })
}

export function resolverAlertaML(id, comentario = '', options = {}) {
  return mlFetch(`/alertas/${id}/resolver`, {
    method: 'POST',
    body: JSON.stringify({ comentario }),
    signal: options.signal,
  })
}
