import { z } from "zod";
import { normalizeDominicanPhone } from "../../../domain/services/PhoneService";
import { AddressSchema, VehicleSchema } from "./userSchemas";

export const PhoneSchema = z
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
  purpose: z.enum(["login", "register"]).optional().default("login"),
});

export const VerifyOtpSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export const RegisterWithPhoneSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  email: z
    .union([z.string().email("Formato de correo electrónico no válido"), z.literal("")])
    .optional(),
  names: z.string().min(1, "names es requerido"),
  lastNames: z.string().min(1, "lastNames es requerido"),
  identification: z.string().min(1, "identification es requerida"),
  identificationType: z.preprocess(
    (val) => (val === "Cédula" ? "Cedula" : val),
    z.enum(["Cedula", "Pasaporte"], {
      message: "identificationType debe ser Cedula o Pasaporte",
    })
  ),
  userType: z
    .enum(["client", "driver", "seller"], {
      message: "userType debe ser client, driver o seller",
    })
    .optional()
    .default("client"),
  personType: z
    .enum(["fisica", "juridica"], {
      message: "personType debe ser fisica o juridica",
    })
    .optional()
    .default("fisica"),
  companyRnc: z.string().optional(),
  companyName: z.string().optional(),
  addresses: z.array(AddressSchema).optional(),
  vehicle: z.preprocess(
    (val) => {
      if (!val || typeof val !== "object") return undefined;
      const v = val as any;
      if (!v.brand && !v.model && !v.plateNumber) return undefined;
      return val;
    },
    VehicleSchema.optional()
  ),
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
