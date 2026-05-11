import { z } from 'zod'

/**
 * Esquema de validación para productos farmacéuticos.
 * Alineado con Arquitectura Lógica v4 — tabla productos.
 */
export const productoEsquema = z.object({
  codigoInterno: z.string().min(1, 'El código interno es obligatorio').max(50),
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio').max(200),
  principioActivo: z.string().min(1, 'El principio activo es obligatorio').max(200),
  formaFarmaceutica: z.enum(['tableta', 'cápsula', 'jarabe', 'crema', 'suspensión', 'inyectable'], {
    errorMap: () => ({ message: 'Seleccione una forma farmacéutica válida' }),
  }),
  concentracion: z.string().min(1, 'La concentración es obligatoria'),
  laboratorio: z.string().min(1, 'El laboratorio es obligatorio'),
  codigoBarras: z.string().optional(),
  categoriaTerapeutica: z.string().min(1, 'La categoría terapéutica es obligatoria'),
  clasificacion: z.enum(['OTC', 'receta', 'generico'], {
    errorMap: () => ({ message: 'Seleccione una clasificación válida' }),
  }),
  requiereReceta: z.boolean(),
  estado: z.enum(['activo', 'inactivo', 'descontinuado']).default('activo'),
})