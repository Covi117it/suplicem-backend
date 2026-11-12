import { Request, Response } from "express";
import { NotificationFirestoreRepository } from "../../../infrastructure/firestore/NotificationFirestoreRepository";
import { GetMyNotificationsUseCase } from "../../../application/use-cases/notification/GetMyNotificationsUseCase";
import { MarkNotificationAsReadUseCase } from "../../../application/use-cases/notification/MarkNotificationAsReadUseCase";
import { MarkAllNotificationsAsReadUseCase } from "../../../application/use-cases/notification/MarkAllNotificationsAsReadUseCase";

const defaultRepo = new NotificationFirestoreRepository();

export class NotificationController {
  constructor(
    private getMyNotificationsUseCase = new GetMyNotificationsUseCase(defaultRepo),
    private markNotificationAsReadUseCase = new MarkNotificationAsReadUseCase(defaultRepo),
    private markAllAsReadUseCase = new MarkAllNotificationsAsReadUseCase(defaultRepo)
  ) {}

  async getMyNotifications(req: Request, res: Response) {
    try {
      const recipientId = (req as any).user?.uid;
      const limitCount = req.query.limit ? Number(req.query.limit) : 50;

      const notifications = await this.getMyNotificationsUseCase.execute(recipientId, limitCount);
      res.status(200).json({ success: true, notifications });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener las notificaciones",
      });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const recipientId = (req as any).user?.uid;
      const { id } = req.params;

      await this.markNotificationAsReadUseCase.execute(id, recipientId);
      GetMyNotificationsUseCase.invalidateCache(recipientId);
      res.status(200).json({ success: true, message: "Notificación marcada como leída" });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al marcar la notificación",
      });
    }
  }

  async markAllAsRead(req: Request, res: Response) {
    try {
      const recipientId = (req as any).user?.uid;

      await this.markAllAsReadUseCase.execute(recipientId);
      GetMyNotificationsUseCase.invalidateCache(recipientId);
      res.status(200).json({ success: true, message: "Todas las notificaciones marcadas como leídas" });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al marcar las notificaciones",
      });
    }
  }
}
