import { firestore } from "../../config/firebase";
import { Order } from "../../domain/entities/Order";
import { OrderRepository, OrderFilters } from "../../domain/repositories/OrderRepository";
import { FieldPath } from "firebase-admin/firestore";

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
      .get();

    let userDocData: any = null;
    try {
      const uDoc = await firestore.collection("users").doc(userId).get();
      if (uDoc.exists) userDocData = uDoc.data();
    } catch (e) {
      console.warn("Error obteniendo usuario para getByUser:", e);
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const fallbackDeliveryAddress =
        data.deliveryAddress ||
        (data.deliveries && data.deliveries.length > 0
          ? data.deliveries[0].address
          : undefined);
      return {
        id: doc.id,
        ...data,
        deliveryAddress: fallbackDeliveryAddress,
        userPhone: data.userPhone || userDocData?.phone || "",
        userNames: data.userNames || userDocData?.names || "",
        userLastNames: data.userLastNames || userDocData?.lastNames || "",
        userEmail: data.userEmail || userDocData?.email || "",
      } as Order;
    });
  }

  async getById(orderId: string): Promise<Order | null> {
    const doc = await firestore.collection("orders").doc(orderId).get();
    if (!doc.exists) return null;
    const orderData = { id: doc.id, ...doc.data() } as Order;

    if (!orderData.deliveryAddress && orderData.deliveries && orderData.deliveries.length > 0) {
      orderData.deliveryAddress = orderData.deliveries[0].address;
    }

    if (orderData.userId) {
      try {
        const userDoc = await firestore
          .collection("users")
          .doc(orderData.userId)
          .get();
        if (userDoc.exists) {
          const u = userDoc.data();
          orderData.userPhone = u?.phone || orderData.userPhone || "";
          orderData.userNames = u?.names || orderData.userNames || "";
          orderData.userLastNames = u?.lastNames || orderData.userLastNames || "";
          orderData.userEmail = u?.email || orderData.userEmail || "";
          orderData.clientAddresses = u?.addresses || [];
        }
      } catch (e) {
        console.warn(`Error al enriquecer orden ${orderId} con datos del usuario:`, e);
      }
    }

    return orderData;
  }

  async getAll(filters?: OrderFilters | string): Promise<Order[]> {
    let query: FirebaseFirestore.Query = firestore.collection("orders");

    const parsedFilters: OrderFilters =
      typeof filters === "string"
        ? (filters && filters !== "undefined" ? { status: filters } : {})
        : filters || {};

    if (parsedFilters.status && parsedFilters.status !== "undefined") {
      query = query.where("status", "==", parsedFilters.status);
    }
    if (parsedFilters.deliveryType) {
      query = query.where("deliveryType", "==", parsedFilters.deliveryType);
    }
    if (parsedFilters.userId) {
      query = query.where("userId", "==", parsedFilters.userId);
    }

    const snapshot = await query.get();

    const rawOrders: Order[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];

    const userIdsToFetch = [
      ...new Set(
        rawOrders
          .filter((o) => o.userId && (!o.userPhone || !o.userNames))
          .map((o) => o.userId)
      ),
    ];

    const userMap = new Map<string, any>();
    if (userIdsToFetch.length > 0) {
      for (let i = 0; i < userIdsToFetch.length; i += 10) {
        const chunk = userIdsToFetch.slice(i, i + 10);
        try {
          const uSnap = await firestore
            .collection("users")
            .where(FieldPath.documentId(), "in", chunk)
            .get();
          uSnap.docs.forEach((uDoc) => userMap.set(uDoc.id, uDoc.data()));
        } catch (e) {
          console.warn("Error fetching users for orders enrichment:", e);
        }
      }
    }

    let ordersWithTrip = await Promise.all(
      rawOrders.map(async (orderData) => {
        if (orderData.userId && userMap.has(orderData.userId)) {
          const u = userMap.get(orderData.userId);
          orderData.userPhone = u?.phone || orderData.userPhone || "";
          orderData.userNames = u?.names || orderData.userNames || "";
          orderData.userLastNames = u?.lastNames || orderData.userLastNames || "";
          orderData.userEmail = u?.email || orderData.userEmail || "";
        }

        if (!orderData.deliveryAddress && orderData.deliveries && orderData.deliveries.length > 0) {
          orderData.deliveryAddress = orderData.deliveries[0].address;
        }

        try {
          const tripSnap = await firestore
            .collection("trips")
            .where("orderIds", "array-contains", orderData.id!)
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
          console.warn(`Error al consultar trip para la orden ${orderData.id}:`, tripError);
        }

        return orderData;
      })
    );

    if (parsedFilters.withoutTrip) {
      ordersWithTrip = ordersWithTrip.filter((o) => !o.tripId);
    }

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

  async attachDeliveryProof(
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
