import { z } from "zod";
import { normalizeDominicanPhone } from "../../../domain/services/PhoneService";

const PhoneSchema = z
  .string()
  .min(10, "El teléfono es requerido")
  .refine(
    (value) => {
      try {
        normalizeDominicanPhone(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Número de teléfono dominicano inválido" }
  );

export const LoginSchema = z.object({
  email: z.string().email("Formato de correo electrónico no válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken es requerido"),
});

export const RequestOtpSchema = z.object({
  phone: PhoneSchema,
});

export const VerifyOtpSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
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
