import { Notification } from "../../../domain/entities/Notification";
import { NotificationRepository } from "../../../domain/repositories/NotificationRepository";

export class GetMyNotificationsUseCase {
  constructor(private notificationRepo: NotificationRepository) {}

  async execute(recipientId: string, limitCount = 50): Promise<Notification[]> {
    if (!recipientId || !recipientId.trim()) {
      throw new Error("El ID del destinatario es obligatorio");
    }
    return this.notificationRepo.getByRecipient(recipientId, limitCount);
  }
}
