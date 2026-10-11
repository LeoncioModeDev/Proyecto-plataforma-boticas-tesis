import { z } from 'zod'

export const SUBTIPOS = {
  AJUSTE_POSITIVO: 'ajuste_positivo',
  AJUSTE_NEGATIVO: 'ajuste_negativo',
  MERMA_VENCIMIENTO: 'merma_vencimiento',
  MERMA_DANO: 'merma_dano',
  MERMA_PERDIDA: 'merma_perdida',
}

export const SUBTIPOS_AJUSTE = [
  { valor: SUBTIPOS.AJUSTE_POSITIVO, tipo: 'ajuste', direccion: 'incremento', etiqueta: 'Ajuste Positivo' },
  { valor: SUBTIPOS.AJUSTE_NEGATIVO, tipo: 'ajuste', direccion: 'decremento', etiqueta: 'Ajuste Negativo' },
  { valor: SUBTIPOS.MERMA_VENCIMIENTO, tipo: 'merma', direccion: null, etiqueta: 'Merma por Vencimiento' },
  { valor: SUBTIPOS.MERMA_DANO, tipo: 'merma', direccion: null, etiqueta: 'Merma por Daño' },
  { valor: SUBTIPOS.MERMA_PERDIDA, tipo: 'merma', direccion: null, etiqueta: 'Merma por Pérdida' },
]

export function mapearSubtipo(subtipo) {
  const mapa = {
    [SUBTIPOS.AJUSTE_POSITIVO]: { tipoMovimiento: 'ajuste', direccionAjuste: 'incremento' },
    [SUBTIPOS.AJUSTE_NEGATIVO]: { tipoMovimiento: 'ajuste', direccionAjuste: 'decremento' },
    [SUBTIPOS.MERMA_VENCIMIENTO]: { tipoMovimiento: 'merma', direccionAjuste: null },
    [SUBTIPOS.MERMA_DANO]: { tipoMovimiento: 'merma', direccionAjuste: null },
    [SUBTIPOS.MERMA_PERDIDA]: { tipoMovimiento: 'merma', direccionAjuste: null },
  }
  return mapa[subtipo] || null
}

export function esAjuste(subtipo) {
  return subtipo === SUBTIPOS.AJUSTE_POSITIVO || subtipo === SUBTIPOS.AJUSTE_NEGATIVO
}

export function esMerma(subtipo) {
  return !esAjuste(subtipo)
}

export const ajusteEsquema = z.object({
  subtipo: z.enum(
    [SUBTIPOS.AJUSTE_POSITIVO, SUBTIPOS.AJUSTE_NEGATIVO, SUBTIPOS.MERMA_VENCIMIENTO, SUBTIPOS.MERMA_DANO, SUBTIPOS.MERMA_PERDIDA],
    { errorMap: () => ({ message: 'Seleccione un tipo de ajuste válido' }) },
  ),
  productoId: z.string().min(1, 'Debe seleccionar un producto'),
  ubicacionTipo: z.enum(['drogueria', 'botica'], { errorMap: () => ({ message: 'Seleccione un tipo de ubicación' }) }),
  ubicacionId: z.string().min(1, 'Debe seleccionar una ubicación'),
  loteId: z.string().min(1, 'Debe seleccionar un lote'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres para justificar el ajuste'),
})

export const ajusteSubmitEsquema = z.object({
  productoId: z.string().min(1),
  loteId: z.string().min(1),
  ubicacionTipo: z.enum(['drogueria', 'botica']),
  ubicacionId: z.string().min(1),
  direccionAjuste: z.string().nullable().optional(),
  cantidad: z.number().int().positive(),
  motivo: z.string().min(10),
})
