import { z } from "zod";

export const CedulaParamSchema = z.object({
  cedula: z
    .string()
    .regex(/^\d{11}$/, "La cédula debe tener exactamente 11 dígitos"),
});
