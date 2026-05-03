/**
 * Genera un color consistente para una familia ATC dada.
 * Usa un mapeo fijo para asegurar consistencia entre renders.
 */

const COLORES_ATC = {
  A: '#107C41', // Verde principal
  B: '#A4262C', // Rojo
  C: '#0078D4', // Azul
  D: '#C19C00', // Amarillo
  G: '#8764B8', // Púrpura
  H: '#E36209', // Naranja
  J: '#2DA66B', // Verde acento
  L: '#5C2D91', // Púrpura oscuro
  M: '#00A4EF', // Azul claro
  N: '#F25022', // Rojo naranja
  P: '#7FBA00', // Verde lima
  R: '#FFB900', // Ámbar
  S: '#737373', // Gris
  V: '#00BCF2', // Cian
}

/**
 * Retorna un color hexadecimal para la familia ATC especificada.
 */
export function generarColorATC(codigoFamilia) {
  return COLORES_ATC[codigoFamilia] || '#605E5C'
}

/**
 * Retorna todos los colores ATC como array para uso en gráficas.
 */
export function obtenerPaletaATC() {
  return Object.values(COLORES_ATC)
}
