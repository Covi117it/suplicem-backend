import { NotificationRepository } from "../../../domain/repositories/NotificationRepository";

export class MarkAllNotificationsAsReadUseCase {
  constructor(private notificationRepo: NotificationRepository) {}

  async execute(recipientId: string): Promise<void> {
    if (!recipientId) {
      throw new Error("El ID del destinatario es obligatorio");
    }
    await this.notificationRepo.markAllAsRead(recipientId);
  }
}
