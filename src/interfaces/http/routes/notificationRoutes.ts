import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";
import { authenticate } from "../middlewares/authenticate";
import { validate } from "../middlewares/validate";
import {
  MarkNotificationAsReadSchema,
  GetNotificationsQuerySchema,
} from "../schemas/notificationSchemas";

export const notificationRoutes = (router: Router) => {
  const controller = new NotificationController();

  // GET  /notifications           — Obtiene las notificaciones del usuario autenticado
  router.get(
    "/notifications",
    authenticate,
    validate(GetNotificationsQuerySchema),
    (req, res) => controller.getMyNotifications(req, res)
  );

  // PATCH /notifications/:id/read — Marca una notificación como leída
  router.patch(
    "/notifications/:id/read",
    authenticate,
    validate(MarkNotificationAsReadSchema),
    (req, res) => controller.markAsRead(req, res)
  );

  // PATCH /notifications/read-all — Marca todas como leídas
  router.patch(
    "/notifications/read-all",
    authenticate,
    (req, res) => controller.markAllAsRead(req, res)
  );
};
