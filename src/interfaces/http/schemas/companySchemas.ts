import { z } from "zod";

export const RegisterCompanySchema = z.object({
  rnc: z.string().min(9, "El RNC es requerido"),
  name: z.string().min(2, "El nombre de la empresa es requerido"),
  commercialName: z.string().optional(),
  email: z.string().email("Correo electrónico inválido").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
