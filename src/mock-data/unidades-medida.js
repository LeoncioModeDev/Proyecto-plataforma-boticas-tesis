export const unidadesMedida = [
  { id: 'um-001', nombre: 'Miligramo', simbolo: 'mg' },
  { id: 'um-002', nombre: 'Gramo', simbolo: 'g' },
  { id: 'um-003', nombre: 'Mililitro', simbolo: 'mL' },
  { id: 'um-004', nombre: 'Porcentaje', simbolo: '%' },
  { id: 'um-005', nombre: 'Miligramo por Mililitro', simbolo: 'mg/mL' },
  { id: 'um-006', nombre: 'Microgramo', simbolo: 'mcg' },
  { id: 'um-007', nombre: 'Unidad Internacional', simbolo: 'UI' },
  { id: 'um-008', nombre: 'Milimol', simbolo: 'mmol' },
  { id: 'um-009', nombre: 'Miliequivalente', simbolo: 'mEq' },
  { id: 'um-010', nombre: 'Microgramo por Mililitro', simbolo: 'mcg/mL' },
  { id: 'um-011', nombre: 'Unidad', simbolo: 'U' },
  { id: 'um-012', nombre: 'Miligramo por Gramo', simbolo: 'mg/g' },
]

export const OPCIONES_UNIDADES_MEDIDA = unidadesMedida.map(um => ({
  valor: um.id,
  etiqueta: um.simbolo,
}))
