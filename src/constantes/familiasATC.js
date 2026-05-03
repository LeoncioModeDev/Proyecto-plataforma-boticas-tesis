/**
 * Familias del sistema de Clasificación Anatómica Terapéutica Química (ATC).
 * Lista de las principales familias con código y descripción.
 */
export const FAMILIAS_ATC = [
  { codigo: 'A', descripcion: 'Tracto Alimentario y Metabolismo' },
  { codigo: 'B', descripcion: 'Sangre y Órganos Hematopoyéticos' },
  { codigo: 'C', descripcion: 'Sistema Cardiovascular' },
  { codigo: 'D', descripcion: 'Dermatológicos' },
  { codigo: 'G', descripcion: 'Sistema Genitourinario y Hormonas Sexuales' },
  { codigo: 'H', descripcion: 'Preparados Hormonales Sistémicos' },
  { codigo: 'J', descripcion: 'Antiinfecciosos de Uso Sistémico' },
  { codigo: 'L', descripcion: 'Agentes Antineoplásicos e Inmunomoduladores' },
  { codigo: 'M', descripcion: 'Sistema Musculoesquelético' },
  { codigo: 'N', descripcion: 'Sistema Nervioso' },
  { codigo: 'P', descripcion: 'Productos Antiparasitarios' },
  { codigo: 'R', descripcion: 'Sistema Respiratorio' },
  { codigo: 'S', descripcion: 'Órganos de los Sentidos' },
  { codigo: 'V', descripcion: 'Varios' },
]

export const OPCIONES_ATC = FAMILIAS_ATC.map(({ codigo, descripcion }) => ({
  valor: codigo,
  etiqueta: `${codigo} — ${descripcion}`,
}))
