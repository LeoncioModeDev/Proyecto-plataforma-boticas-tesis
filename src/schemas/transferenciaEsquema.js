import { z } from 'zod'

/**
 * Esquema de validación para transferencias entre ubicaciones.
 */
export const transferenciaEsquema = z.object({
  destinoId: z.string().min(1, 'Debe seleccionar una botica destino'),
  observaciones: z.string().optional(),
  items: z.array(z.object({
    productoId: z.string().min(1, 'Debe seleccionar un producto'),
    loteId: z.string().optional(),
    cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  })).min(1, 'Debe agregar al menos un producto a la transferencia'),
})
