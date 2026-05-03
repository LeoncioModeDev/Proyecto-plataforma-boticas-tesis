import { z } from 'zod'

/**
 * Esquema de validación para ajustes y mermas de inventario.
 */
export const ajusteEsquema = z.object({
  tipo: z.enum(['ajuste_positivo', 'ajuste_negativo', 'merma_vencimiento', 'merma_dano', 'merma_perdida'], {
    errorMap: () => ({ message: 'Seleccione un tipo de ajuste válido' }),
  }),
  productoId: z.string().min(1, 'Debe seleccionar un producto'),
  loteId: z.string().optional(),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres para justificar el ajuste'),
})
