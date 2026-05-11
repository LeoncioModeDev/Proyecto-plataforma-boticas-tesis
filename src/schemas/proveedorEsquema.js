import { z } from 'zod'

export const proveedorEsquema = z.object({
  razonSocial: z.string().min(5, 'La razón social debe tener al menos 5 caracteres'),
  tipoIdentificacion: z.enum(['ruc', 'nit', 'tax_id', 'vat', 'otro'], {
    errorMap: () => ({ message: 'Seleccione un tipo de identificación válido' }),
  }),
  numeroIdentificacion: z.string().min(5, 'El número de identificación es obligatorio'),
  paisOrigen: z.string().length(2, 'CodifiqueISO 3166-1 alpha-2 de 2 letras'),
  contacto: z.string().min(3, 'Ingrese el nombre del contacto'),
  telefono: z.string().min(7, 'Ingrese un teléfono válido'),
  correo: z.string().email('Ingrese un correo válido'),
  direccion: z.string().min(10, 'La dirección debe tener al menos 10 caracteres'),
  ubigeo: z.string().optional(),
  distrito: z.string().min(3, 'Ingrese el distrito'),
  leadTimeDias: z.coerce.number().int().min(1, 'El lead time debe ser al menos 1 día').max(90, 'El lead time no puede superar 90 días'),
  condicionesPago: z.string().min(3, 'Ingrese las condiciones de pago'),
  activo: z.boolean().default(true),
})

export const proveedorEsquemaParcial = proveedorEsquema.partial()