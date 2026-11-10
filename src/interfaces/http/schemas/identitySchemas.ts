import { z } from "zod";

export const CedulaParamSchema = z.object({
  cedula: z
    .string()
    .regex(/^\d{11}$/, "La cédula debe tener exactamente 11 dígitos"),
});

export const RncParamSchema = z.object({
  rnc: z
    .string()
    .regex(/^(\d{9}|\d{11})$/, "El RNC debe tener 9 u 11 dígitos numéricos"),
});
