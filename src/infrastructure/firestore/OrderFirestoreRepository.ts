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

        try {
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
              tripId: tripDoc.id,
            };
          }
        } catch (tripError) {
          console.warn(`Error al consultar trip para la orden ${doc.id}:`, tripError);
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

  async completeDelivery(
    orderId: string,
    index: number,
    options: { comment?: string; imageUrl?: string }
  ): Promise<void> {
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
    if (options.comment) {
      data.deliveries[index].comment = options.comment;
    }
    if (options.imageUrl) {
      data.deliveries[index].imageUrl = options.imageUrl;
    }

    await ref.update({ deliveries: data.deliveries });
  }

  async updateDeliveries(
    orderId: string,
    deliveryType: string,
    deliveries: any[]
  ): Promise<any> {
    return await firestore.runTransaction(async (transaction) => {
      const orderRef = firestore.collection("orders").doc(orderId);

      // Recolectar userUids para direcciones secundarias
      const userUids = [
        ...new Set(
          deliveries
            .map((d: any) => d.address?.userUid)
            .filter(
              (uid: string) => uid && typeof uid === "string" && !uid.startsWith("new-user-")
            )
        ),
      ] as string[];

      const userRefs = userUids.map((uid) =>
        firestore.collection("users").doc(uid)
      );

      // 1. Ejecutar TODAS las lecturas primero (orden y usuarios)
      const orderSnap = await transaction.get(orderRef);
      const userSnaps = await Promise.all(
        userRefs.map((ref) => transaction.get(ref))
      );

      if (!orderSnap.exists) {
        throw new Error("Orden no encontrada");
      }

      const orderData = orderSnap.data() as any;
      const items = orderData.items || [];

      // Mapear cantidad pedida por producto
      const orderedQuantities = new Map<string, number>();
      items.forEach((item: any) => {
        orderedQuantities.set(item.productId, Number(item.quantity) || 0);
      });

      // Mapear cantidad ya entregada en entregas previas
      const deliveredQuantities = new Map<string, number>();
      const existingDeliveries = orderData.deliveries || [];
      existingDeliveries.forEach((del: any) => {
        if (del.status === "delivered" || del.delivered === true) {
          const current = deliveredQuantities.get(del.productId) || 0;
          deliveredQuantities.set(
            del.productId,
            current + (Number(del.quantity) || 0)
          );
        }
      });

      // Mapear la nueva asignación solicitada en la petición
      const requestedQuantities = new Map<string, number>();
      for (const del of deliveries) {
        if (!del.productId) {
          throw new Error("Cada entrega debe especificar un producto válido.");
        }
        const qty = Number(del.quantity) || 0;
        const current = requestedQuantities.get(del.productId) || 0;
        requestedQuantities.set(del.productId, current + qty);
      }

      // Validar disponibilidad real: (cantidad_pedida - (cantidad_entregada + reservada_activa))
      for (const [productId, requestedQty] of requestedQuantities.entries()) {
        const pedida = orderedQuantities.get(productId) || 0;
        const entregada = deliveredQuantities.get(productId) || 0;
        const reservadaActiva = 0;
        const disponible = pedida - (entregada + reservadaActiva);

        if (requestedQty > disponible) {
          const item = items.find((i: any) => i.productId === productId);
          const productName = item?.name || "el producto";
          throw new Error(
            `La cantidad asignada (${requestedQty}) para ${productName} supera la disponibilidad real (${disponible}).`
          );
        }
      }

      // 2. Ejecutar TODAS las escrituras después de las lecturas
      for (let i = 0; i < userSnaps.length; i++) {
        const userSnap = userSnaps[i];
        if (userSnap.exists) {
          const userData = userSnap.data();
          const existingAddresses = userData?.addresses || [];
          const userUid = userUids[i];
          const newAddresses = deliveries
            .map((d: any) => d.address)
            .filter(
              (a: any) =>
                a &&
                a.userUid === userUid &&
                a.placeId &&
                !a.placeId.startsWith("new-")
            );

          let updatedAddresses = [...existingAddresses];
          let updated = false;

          for (const addr of newAddresses) {
            if (
              !updatedAddresses.some((a: any) => a.placeId === addr.placeId)
            ) {
              updatedAddresses.push(addr);
              updated = true;
            }
          }

          if (updated) {
            transaction.update(userRefs[i], { addresses: updatedAddresses });
          }
        }
      }

      const sanitizedDeliveries = deliveries.map((del: any) => ({
        id: del.id || firestore.collection("orders").doc().id,
        productId: del.productId,
        quantity: Number(del.quantity) || 0,
        unit: del.unit || "fundas",
        status: del.status || "pending",
        address: del.address || null,
      }));

      transaction.update(orderRef, {
        deliveryType,
        deliveries: sanitizedDeliveries,
        updatedAt: new Date().toISOString(),
      });

      return {
        id: orderSnap.id,
        ...orderData,
        deliveryType,
        deliveries: sanitizedDeliveries,
      };
    });
  }
}
