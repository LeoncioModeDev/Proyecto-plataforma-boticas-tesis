import { z } from 'zod'

/**
 * Esquema de validación para productos farmacéuticos.
 */
export const productoEsquema = z.object({
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio').max(200),
  principioActivo: z.string().min(1, 'El principio activo es obligatorio').max(200),
  formaFarmaceutica: z.enum(['tableta', 'capsula', 'jarabe', 'crema', 'suspension', 'inyectable'], {
    errorMap: () => ({ message: 'Seleccione una forma farmacéutica válida' }),
  }),
  concentracion: z.string().min(1, 'La concentración es obligatoria'),
  laboratorio: z.string().min(1, 'El laboratorio es obligatorio'),
  codigoBarras: z.string().optional(),
  clasificacion: z.enum(['otc', 'receta', 'generico'], {
    errorMap: () => ({ message: 'Seleccione una clasificación válida' }),
  }),
  estado: z.enum(['activo', 'inactivo', 'descontinuado']).default('activo'),
})
