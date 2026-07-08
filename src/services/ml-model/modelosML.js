import { mlFetch } from './clienteML'

export function obtenerHealthML(options = {}) {
  return mlFetch('/health', { method: 'GET', signal: options.signal })
}

export function obtenerEstadoModelo(options = {}) {
  return mlFetch('/modelos/estado', { method: 'GET', signal: options.signal })
}

export function obtenerMetricasModelo(options = {}) {
  return mlFetch('/modelos/metricas', { method: 'GET', signal: options.signal })
}

export function obtenerDriftModelo(options = {}) {
  return mlFetch('/modelos/drift', { method: 'GET', signal: options.signal })
}

export function obtenerDiagnosticoSupabase(options = {}) {
  return mlFetch('/diagnostico/supabase', { method: 'GET', signal: options.signal })
}

export function obtenerSerieValida(options = {}) {
  return mlFetch('/diagnostico/serie-valida', { method: 'GET', signal: options.signal })
}

export function reentrenarModelo(payload = {}, options = {}) {
  return mlFetch('/modelos/reentrenar', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
    headers: options.retrainSecret ? { 'X-Retrain-Secret': options.retrainSecret } : undefined,
  })
}

export function obtenerEstadoReentrenamiento(jobId, options = {}) {
  return mlFetch(`/modelos/reentrenamientos/${jobId}`, { method: 'GET', signal: options.signal })
}

export function verificarReentrenamiento(options = {}) {
  return mlFetch('/modelos/verificar-reentrenamiento', { method: 'POST', signal: options.signal })
}
