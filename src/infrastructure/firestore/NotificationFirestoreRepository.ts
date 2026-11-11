import { firestore } from "../../config/firebase";
import { Notification } from "../../domain/entities/Notification";
import { NotificationRepository } from "../../domain/repositories/NotificationRepository";

const COLLECTION = "notifications";

export class NotificationFirestoreRepository implements NotificationRepository {
  private _mapDoc(doc: FirebaseFirestore.DocumentSnapshot): Notification {
    const data = doc.data() || {};
    return {
      id: doc.id,
      recipientId: data.recipientId || "",
      recipientRole: data.recipientRole,
      type: data.type,
      category: data.category,
      actorId: data.actorId,
      actorName: data.actorName || "",
      actorRole: data.actorRole,
      actorAvatar: data.actorAvatar,
      title: data.title || "",
      description: data.description || "",
      isRead: !!data.isRead,
      createdAt: data.createdAt || new Date().toISOString(),
      preview: data.preview,
    };
  }

  async create(notification: Omit<Notification, "id">): Promise<string> {
    try {
      const docRef = await firestore.collection(COLLECTION).add({
        ...notification,
        createdAt: notification.createdAt || new Date().toISOString(),
        isRead: false,
      });
      return docRef.id;
    } catch (error: any) {
      console.error("[NotificationRepo] Error en create:", error?.message || error);
      throw new Error("No se pudo crear la notificación en la base de datos");
    }
  }

  async getByRecipient(recipientId: string, limitCount = 50): Promise<Notification[]> {
    try {
      const snapshot = await firestore
        .collection(COLLECTION)
        .where("recipientId", "==", recipientId)
        .limit(limitCount)
        .get();

      const list = snapshot.docs.map((doc) => this._mapDoc(doc));
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error: any) {
      console.warn("[NotificationRepo] Error en getByRecipient:", error?.message || error);
      return [];
    }
  }

  async markAsRead(id: string, recipientId: string): Promise<void> {
    try {
      const ref = firestore.collection(COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return;
      if (doc.data()?.recipientId !== recipientId) return;

      await ref.update({ isRead: true });
    } catch (error: any) {
      console.error("[NotificationRepo] Error en markAsRead:", error?.message || error);
    }
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    try {
      const snapshot = await firestore
        .collection(COLLECTION)
        .where("recipientId", "==", recipientId)
        .where("isRead", "==", false)
        .get();

      if (snapshot.empty) return;

      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });
      await batch.commit();
    } catch (error: any) {
      console.error("[NotificationRepo] Error en markAllAsRead:", error?.message || error);
    }
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      const snapshot = await firestore
        .collection(COLLECTION)
        .where("recipientId", "==", recipientId)
        .where("isRead", "==", false)
        .get();

      return snapshot.size;
    } catch (error: any) {
      console.warn("[NotificationRepo] Error en getUnreadCount:", error?.message || error);
      return 0;
    }
  }
}
