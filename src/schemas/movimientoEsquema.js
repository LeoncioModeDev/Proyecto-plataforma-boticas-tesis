import { z } from 'zod'

/**
 * Esquema de validación para movimientos de inventario.
 * Alineado con Arquitectura Lógica v4 — movimientos_inventario.
 */
export const movimientoEsquema = z.object({
  tipo: z.enum(['entrada', 'salida', 'ajuste', 'merma', 'devolucion'], {
    errorMap: () => ({ message: 'Seleccione un tipo de movimiento válido' }),
  }),
  productoId: z.string().min(1, 'Debe seleccionar un producto'),
  loteId: z.string().optional(),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  ubicacionId: z.string().min(1, 'Debe seleccionar una ubicación'),
  motivo: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
  usuarioId: z.string().min(1, 'Debe haber un usuario autenticado'),
  transferenciaId: z.string().optional(),
})