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

export function obtenerDiagnosticoSupabase(options = {}) {
  return mlFetch('/diagnostico/supabase', { method: 'GET', signal: options.signal })
}

export function obtenerSerieValida(options = {}) {
  return mlFetch('/diagnostico/serie-valida', { method: 'GET', signal: options.signal })
}
