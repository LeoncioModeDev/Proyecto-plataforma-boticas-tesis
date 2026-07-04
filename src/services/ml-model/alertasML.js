import { mlFetch } from './clienteML'

export function evaluarAlertas(options = {}) {
  return mlFetch('/alertas/evaluar', { method: 'POST', signal: options.signal })
}

export function resolverAlertaML(id, comentario = '', options = {}) {
  return mlFetch(`/alertas/${id}/resolver`, {
    method: 'POST',
    body: JSON.stringify({ comentario }),
    signal: options.signal,
  })
}
