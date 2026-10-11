import { z } from 'zod'

const contactoSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, 'Ingrese el nombre del contacto'),
  telefono: z.string().min(7, 'Ingrese un teléfono válido').optional().or(z.literal('')),
  correo: z.string().email('Ingrese un correo válido').optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
  ubigeo: z.string().optional().or(z.literal('')),
  principal: z.boolean().default(false),
})

export const proveedorEsquema = z.object({
  razonSocial: z.string().min(5, 'La razón social debe tener al menos 5 caracteres'),
  tipoIdentificacion: z.enum(['ruc', 'dni', 'carnet-extranjeria', 'pasaporte'], {
    errorMap: () => ({ message: 'Seleccione un tipo de identificación válido' }),
  }),
  numeroIdentificacion: z.string().min(5, 'El número de identificación es obligatorio'),
  paisOrigen: z.string().length(2, 'Código ISO 3166-1 alpha-2 de 2 letras'),
  monedaId: z.string().uuid('Seleccione una moneda').nullable(),
  activo: z.boolean().default(true),
  contactos: z.array(contactoSchema)
    .min(1, 'Agregue al menos un contacto')
    .refine(c => c.some(ct => ct.principal), {
      message: 'Debe haber al menos un contacto marcado como principal',
    }),
})

export const proveedorEsquemaParcial = proveedorEsquema.partial()