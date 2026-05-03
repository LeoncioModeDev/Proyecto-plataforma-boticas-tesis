import { z } from 'zod'

/**
 * Esquema de validación para lotes de productos.
 */
export const loteEsquema = z.object({
  productoId: z.string().min(1, 'Debe seleccionar un producto'),
  ubicacionId: z.string().min(1, 'Debe seleccionar una ubicación'),
  numeroLote: z.string().min(1, 'El número de lote es obligatorio'),
  fechaVencimiento: z.string().min(1, 'La fecha de vencimiento es obligatoria').refine((val) => {
    return new Date(val) > new Date()
  }, 'La fecha de vencimiento debe ser futura'),
  cantidad: z.coerce.number().int('Debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  proveedorId: z.string().optional(),
})
