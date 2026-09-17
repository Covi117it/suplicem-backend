import { z } from "zod";

export const CreateTripSchema = z.object({
  tripNumber: z.string().min(1, "tripNumber es requerido"),
  orderIds: z.array(z.string().min(1)).min(1, "Debe incluir al menos una orden"),
  comments: z.string().optional(),
  totalTons: z.number().positive("totalTons debe ser mayor a 0").optional(),
});

export const UpdateTripStatusSchema = z.object({
  tripId: z.string().min(1, "tripId es requerido"),
  status: z.enum(["available", "accepted", "started", "completed", "canceled"], {
    message: "status no válido",
  }),
});