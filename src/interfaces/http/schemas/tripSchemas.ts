import { z } from "zod";

export const CreateTripSchema = z.object({
  tripNumber: z.string().min(1, "tripNumber es requerido"),
  orderIds: z
    .array(z.string().min(1))
    .min(1, "Debe incluir al menos una orden")
    .transform((ids) => [...new Set(ids)]), 
  driverId: z.string().optional(),
  comments: z.string().optional(),
  totalTons: z.number().positive("totalTons debe ser mayor a 0").optional(),
});

const tripStatusEnum = z.enum([
  "available",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "canceled",
  "started",
], {
  message: "El estado objetivo debe ser: available, assigned, accepted, in_progress, completed, canceled o started",
});

export const UpdateTripStatusSchema = z
  .object({
    status: tripStatusEnum.optional(),
    targetStatus: tripStatusEnum.optional(),
    cancellationReason: z.string().optional(),
    reason: z.string().optional(),
    deliveryPin: z.string().optional(),
  })
  .refine((data) => Boolean(data.status || data.targetStatus), {
    message: "Debes enviar 'status' o 'targetStatus'.",
  })
  .transform((data) => ({
    ...data,
    targetStatus: data.targetStatus || data.status,
    status: data.status || data.targetStatus,
  }));

export const AcceptTripSchema = z.object({}).passthrough().optional().default({});