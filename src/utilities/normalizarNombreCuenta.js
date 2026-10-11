const PARTICULAS = new Set(['del', 'de', 'la', 'las', 'los', 'y', 'e', 'el', 'en', 'un', 'una'])

export function normalizarNombreCuenta(nombreCompleto) {
  if (!nombreCompleto?.trim()) return ''

  const partes = nombreCompleto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const filtradas = partes.filter(p => !PARTICULAS.has(p))
  const nombre = filtradas[0] || partes[0] || ''
  const apellido = filtradas.length > 1 ? filtradas[filtradas.length - 1] : ''

  return [nombre, apellido].filter(Boolean).join('.').replace(/\.+/g, '.')
}
