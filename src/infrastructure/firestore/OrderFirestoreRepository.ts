import { firestore } from "../../config/firebase";
import { Order } from "../../domain/entities/Order";
import { OrderRepository } from "../../domain/repositories/OrderRepository";

export class OrderFirestoreRepository implements OrderRepository {
  async create(
    order: Order
  ): Promise<{ orderId: string; orderNumber: number }> {
    const docRef = await firestore.collection("orders").add(order);
    return {
      orderId: docRef.id,
      orderNumber: order.orderNumber,
    };
  }

  async getByUser(userId: string): Promise<Order[]> {
    const snapshot = await firestore
      .collection("orders")
      .where("userId", "==", userId)
      //.orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  }

  async getById(orderId: string): Promise<Order | null> {
    const doc = await firestore.collection("orders").doc(orderId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Order;
  }

  async getAll(status?: string): Promise<Order[]> {
    let query: FirebaseFirestore.Query = firestore.collection("orders");

    if (status && status !== "undefined") {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    const ordersWithTrip = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const orderData = {
          id: doc.id,
          ...doc.data(),
        } as Order;

        // Verificamos si esta orden está en algún trip
        const tripSnap = await firestore
          .collection("trips")
          .where("orderIds", "array-contains", doc.id)
          .limit(1)
          .get();

        if (!tripSnap.empty) {
          const tripDoc = tripSnap.docs[0];
          return {
            ...orderData,
            tripId: tripDoc.id, // <-- Añadimos el tripId
          };
        }

        return orderData;
      })
    );

    return ordersWithTrip;
  }

  async getNextOrderNumber(): Promise<number> {
    const counterRef = firestore.collection("counters").doc("orders");

    return await firestore.runTransaction(async (tx) => {
      const counterDoc = await tx.get(counterRef);

      if (!counterDoc.exists) {
        const initial = 1001;
        tx.set(counterRef, { current: initial });
        return initial;
      }

      const current = counterDoc.data()?.current || 1000;
      const next = current + 1;

      tx.update(counterRef, { current: next });
      return next;
    });
  }

  async updateStatus(
    orderId: string,
    status: "approved" | "rejected",
    reason?: string
  ): Promise<void> {
    const updateData: Partial<Order> = {
      status,
    };

    if (status === "rejected" && reason) {
      updateData.rejectionReason = reason;
    }

    await firestore.collection("orders").doc(orderId).update(updateData);
  }

  async markDeliveryAsCompleted(orderId: string, index: number): Promise<void> {
    const ref = firestore.collection("orders").doc(orderId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new Error("Orden no encontrada");
    }

    const data = snap.data();
    if (!data?.deliveries || !data.deliveries[index]) {
      throw new Error("Entrega no encontrada");
    }

    data.deliveries[index].delivered = true;
    data.deliveries[index].status = "delivered";

    await ref.update({ deliveries: data.deliveries });
  }
}
