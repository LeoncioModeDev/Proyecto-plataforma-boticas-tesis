/**
 * Tema de diseño de botica-demand-ml
 * Exporta tokens de diseño como objeto JS para uso en componentes
 * que no soportan Tailwind directamente (ej: configuración de Recharts)
 */

export const colores = {
  marca: {
    principal: '#107C41',
    oscuro: '#0B5C30',
    claro: '#E6F4EC',
    acento: '#2DA66B',
  },
  neutro: {
    blanco: '#FFFFFF',
    blancoSuave: '#F8F9FA',
    grisBorde: '#E1E1E1',
    grisTexto: '#605E5C',
    negro: '#1B1B1B',
    negroSuave: '#323130',
  },
  estado: {
    critico: '#A4262C',
    criticoFondo: '#FDE7E9',
    advertencia: '#C19C00',
    advertenciaFondo: '#FFF8E1',
    info: '#0078D4',
    infoFondo: '#E6F2FF',
  },
}

export const tipografia = {
  familia: '"Segoe UI", "Inter", system-ui, -apple-system, sans-serif',
  tamanos: {
    h1: '28px',
    h2: '22px',
    h3: '18px',
    cuerpo: '14px',
    secundario: '13px',
    etiqueta: '12px',
  },
}

export const sombras = {
  suave: '0 1px 2px rgba(0, 0, 0, 0.06)',
  media: '0 2px 8px rgba(0, 0, 0, 0.1)',
}

export const radios = {
  boton: '4px',
  tarjeta: '8px',
}

const tema = {
  colores,
  tipografia,
  sombras,
  radios,
}

export default tema
