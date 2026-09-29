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

export const UpdateTripStatusSchema = z.object({
  tripId: z.string().optional(),
  status: z.enum(
    ["available", "accepted", "started", "in_progress", "completed", "canceled"],
    {
      message: "status no válido",
    }
  ),
});

export const AcceptTripSchema = z.object({}).passthrough().optional().default({});