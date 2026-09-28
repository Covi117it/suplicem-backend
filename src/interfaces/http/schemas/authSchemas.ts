import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Formato de correo electrónico no válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken es requerido"),
});

export const RecoverPasswordSchema = z.object({
  email: z.string().email("Formato de correo electrónico no válido"),
});

export const ResendVerificationSchema = z
  .object({
    email: z.string().email("Formato de correo electrónico no válido").optional(),
    idToken: z.string().optional(),
  })
  .refine((data) => data.email || data.idToken, {
    message: "Debe proporcionar el correo electrónico o el idToken",
  });