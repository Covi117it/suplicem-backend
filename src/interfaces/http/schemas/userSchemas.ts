import { z } from "zod";

export const AddressSchema = z.object({
  placeId: z.string().optional().default(""),
  description: z.string().min(1, "description es requerida"),
  latitude: z.coerce
    .number()
    .optional()
    .transform((val) => (val === 0 || isNaN(val as number) ? undefined : val)),
  longitude: z.coerce
    .number()
    .optional()
    .transform((val) => (val === 0 || isNaN(val as number) ? undefined : val)),
  additionalInfo: z.string().optional().default(""),
});

export const VehicleSchema = z.object({
  brand: z.string().min(1, "brand es requerida"),
  model: z.string().min(1, "model es requerido"),
  year: z.union([z.string(), z.number()]).transform((v) => String(v)),
  tons: z.union([z.string(), z.number()]).transform((v) => String(v)),
  plateNumber: z.string().min(1, "plateNumber es requerido"),
});

export const CreateUserSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  names: z.string().min(1, "names es requerido"),
  lastNames: z.string().min(1, "lastNames es requerido"),
  identification: z.string().min(1, "identification es requerida"),
  identificationType: z.preprocess(
    (val) => (val === "Cédula" ? "Cedula" : val),
    z.enum(["Cedula", "Pasaporte"], {
      message: "identificationType debe ser Cedula o Pasaporte",
    })
  ),
  phone: z.string().min(1, "phone es requerido"),
  userType: z.enum(["client", "driver", "admin"]).optional().default("client"),
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

export const UpdateUserSchema = z.object({
  uid: z.string().min(1, "uid es requerido"),
  names: z.string().optional(),
  lastNames: z.string().optional(),
  phone: z.string().optional(),
  addresses: z.array(AddressSchema).optional(),
  vehicle: VehicleSchema.optional(),
  identificationImage: z.string().optional(),
});

export const UpdateUserStatusSchema = z.object({
  uid: z.string().min(1, "uid es requerido"),
  status: z.enum(["pending", "active", "inactive", "banned", "rejected"], {
    message: "status no válido",
  }),
});