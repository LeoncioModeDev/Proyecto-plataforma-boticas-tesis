export function buscarUbigeos(opciones, busqueda) {
  const termino = busqueda.trim().toLocaleLowerCase('es-PE')
  if (!termino) return opciones
  if (/^\d+$/.test(termino)) {
    if (termino.length >= 6) return opciones.filter(op => op.valor === termino)
    return opciones.filter(op => op.valor.startsWith(termino))
  }
  return opciones.filter(op => op.etiqueta.toLocaleLowerCase('es-PE').includes(termino))
}
