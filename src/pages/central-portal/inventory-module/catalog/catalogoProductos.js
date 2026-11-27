const RUTA_CATALOGO_OPERACIONES = '/operaciones/inventario/catalogo'

export function obtenerRutaCatalogo(pathname) {
  const ruta = pathname.toLowerCase()
  return ruta === RUTA_CATALOGO_OPERACIONES || ruta.startsWith(`${RUTA_CATALOGO_OPERACIONES}/`)
    ? RUTA_CATALOGO_OPERACIONES
    : '/central/inventario/catalogo'
}

const normalizarUnidad = (unidad) => unidad.toLowerCase().replace(/\s+/g, '')

export function crearFiltroPrincipios(principioActivoId, concentracion) {
  const termino = concentracion.trim()
  if (!principioActivoId && !termino) return () => true

  // Acepta el valor exacto con punto o coma decimal y una unidad opcional.
  const partes = termino.match(/^(\d+(?:[.,]\d+)?|[.,]\d+)\s*([^\d\s.,].*)?$/)
  if (termino && !partes) return () => false

  const valor = partes ? Number(partes[1].replace(',', '.')) : null
  const unidad = normalizarUnidad(partes?.[2] ?? '')

  return (producto) => (producto.principiosActivos ?? []).some(pa =>
    (!principioActivoId || pa.principioActivoId === principioActivoId) &&
    (valor === null || (pa.concentracion != null && Number(pa.concentracion) === valor)) &&
    (!unidad || normalizarUnidad(pa.unidadMedidaSimbolo ?? '') === unidad)
  )
}
