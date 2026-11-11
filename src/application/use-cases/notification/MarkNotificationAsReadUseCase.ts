import { NotificationRepository } from "../../../domain/repositories/NotificationRepository";

export class MarkNotificationAsReadUseCase {
  constructor(private notificationRepo: NotificationRepository) {}

  async execute(id: string, recipientId: string): Promise<void> {
    if (!id || !recipientId) {
      throw new Error("Identificadores inválidos para marcar la notificación");
    }
    await this.notificationRepo.markAsRead(id, recipientId);
  }
}
