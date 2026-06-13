import { z } from 'zod'

const concentracionSchema = z.object({
  principioActivoId: z.string().min(1, 'Seleccione un principio activo'),
  concentracion: z.coerce.number().positive('Ingrese una concentración válida'),
  unidadMedidaId: z.string().min(1, 'Seleccione la unidad de medida'),
})

export const productoEsquema = z.object({
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio').max(200),
  formaFarmaceuticaId: z.string().min(1, 'Seleccione una forma farmacéutica'),
  presentacion: z.string().optional(),
  clasificacion: z.enum(['OTC', 'receta', 'generico'], {
    errorMap: () => ({ message: 'Seleccione una clasificación válida' }),
  }),
  estado: z.enum(['activo', 'inactivo', 'descontinuado']).default('activo'),
  principiosActivos: z.array(concentracionSchema).min(1, 'Agregue al menos un principio activo'),
})

export const productoEsquemaParcial = productoEsquema.partial()
