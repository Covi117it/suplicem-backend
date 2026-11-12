import { Notification } from "../../../domain/entities/Notification";
import { NotificationRepository } from "../../../domain/repositories/NotificationRepository";
import { TtlCache } from "../../../infrastructure/cache/TtlCache";

export class GetMyNotificationsUseCase {
  private static readonly cache = new TtlCache<Notification[]>(15_000);

  constructor(private notificationRepo: NotificationRepository) {}

  public static invalidateCache(recipientId?: string): void {
    if (recipientId) {
      GetMyNotificationsUseCase.cache.invalidate(`${recipientId}:50`);
      GetMyNotificationsUseCase.cache.invalidate(`${recipientId}:20`);
      GetMyNotificationsUseCase.cache.invalidate(`${recipientId}:60`);
    } else {
      GetMyNotificationsUseCase.cache.invalidate();
    }
  }

  async execute(recipientId: string, limitCount = 50): Promise<Notification[]> {
    if (!recipientId || !recipientId.trim()) {
      throw new Error("El ID del destinatario es obligatorio");
    }
    const key = `${recipientId}:${limitCount}`;
    return GetMyNotificationsUseCase.cache.getOrLoad(key, () =>
      this.notificationRepo.getByRecipient(recipientId, limitCount)
    );
  }
}
