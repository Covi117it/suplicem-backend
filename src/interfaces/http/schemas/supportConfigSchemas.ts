import { z } from "zod";

export const UpdateSupportConfigSchema = z.object({
  whatsapp: z.string().min(1, "El número de WhatsApp es requerido"),
  whatsappMessage: z
    .string()
    .optional()
    .default("Hola, necesito asistencia con el sistema Suplicem"),
  phone: z.string().min(1, "El teléfono de central es requerido"),
  email: z.string().email("Correo electrónico inválido"),
  scheduleWeekday: z.string().min(1, "El horario de Lunes a Viernes es requerido"),
  scheduleSaturday: z.string().min(1, "El horario de Sábados es requerido"),
  scheduleSunday: z
    .string()
    .min(1, "El horario de Domingos/Feriados es requerido"),
});
