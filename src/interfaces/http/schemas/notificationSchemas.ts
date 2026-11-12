import { z } from "zod";

export const MarkNotificationAsReadSchema = z.object({
  id: z.string().min(1, "El ID de la notificación es obligatorio"),
});

export const GetNotificationsQuerySchema = z.object({
  limit: z.string().optional(),
}).optional().default({});
