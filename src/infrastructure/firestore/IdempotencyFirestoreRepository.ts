import { firestore } from "../../config/firebase";
import {
  IdempotencyRecord,
  IdempotencyRepository,
} from "../../domain/repositories/IdempotencyRepository";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas de validez

export class IdempotencyFirestoreRepository implements IdempotencyRepository {
  private collection = firestore.collection("idempotency_keys");

  private getDocRef(key: string, userId: string) {
    const sanitizedKey = key.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return this.collection.doc(`${userId}_${sanitizedKey}`);
  }

  async find(key: string, userId: string): Promise<IdempotencyRecord | null> {
    const doc = await this.getDocRef(key, userId).get();
    if (!doc.exists) return null;

    const data = doc.data() as IdempotencyRecord;
    const isExpired = Date.now() - new Date(data.createdAt).getTime() > TTL_MS;
    if (isExpired) return null;

    return data;
  }

  async reserve(
    key: string,
    userId: string
  ): Promise<{ reserved: boolean; existingRecord?: IdempotencyRecord }> {
    const docRef = this.getDocRef(key, userId);

    try {
      // docRef.create falla atómicamente si el documento ya existe (Error 6 ALREADY_EXISTS)
      await docRef.create({
        key,
        userId,
        orderId: "",
        orderNumber: 0,
        status: "processing",
        createdAt: new Date().toISOString(),
      });
      return { reserved: true };
    } catch (error: any) {
      // Si ya existe, leer el registro existente
      const existingDoc = await docRef.get();
      if (!existingDoc.exists) return { reserved: true };

      let data = existingDoc.data() as IdempotencyRecord;
      const isExpired = Date.now() - new Date(data.createdAt).getTime() > TTL_MS;
      if (isExpired) {
        await docRef.set({
          key,
          userId,
          orderId: "",
          orderNumber: 0,
          status: "processing",
          createdAt: new Date().toISOString(),
        });
        return { reserved: true };
      }

      // Si aún está procesándose concurrentemente, esperar hasta 2 segundos
      if (data.status === "processing") {
        for (let i = 0; i < 4; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const pollDoc = await docRef.get();
          if (pollDoc.exists) {
            const pollData = pollDoc.data() as IdempotencyRecord;
            if (pollData.status === "completed") {
              return { reserved: false, existingRecord: pollData };
            }
          }
        }
      }

      return { reserved: false, existingRecord: data };
    }
  }

  async complete(
    key: string,
    userId: string,
    response: { orderId: string; orderNumber: number }
  ): Promise<void> {
    const docRef = this.getDocRef(key, userId);
    await docRef.set(
      {
        orderId: response.orderId,
        orderNumber: response.orderNumber,
        status: "completed",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}