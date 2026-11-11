import { Notification } from "../entities/Notification";

export interface NotificationRepository {
  create(notification: Omit<Notification, "id">): Promise<string>;
  getByRecipient(recipientId: string, limitCount?: number): Promise<Notification[]>;
  markAsRead(id: string, recipientId: string): Promise<void>;
  markAllAsRead(recipientId: string): Promise<void>;
  getUnreadCount(recipientId: string): Promise<number>;
}
