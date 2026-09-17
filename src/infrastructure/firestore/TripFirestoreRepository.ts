import { firestore } from "../../config/firebase";
import { Trip } from "../../domain/entities/Trip";
import { TripRepository } from "../../domain/repositories/TripRepository";
import { FieldPath } from "firebase-admin/firestore";

export class TripFirestoreRepository implements TripRepository {
  async create(trip: Trip): Promise<string> {
    const docRef = await firestore.collection("trips").add(trip);
    return docRef.id;
  }

  async getAvailable(): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("status", "==", "available")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Trip[];
  }

  async getAll(): Promise<Trip[]> {
    const snapshot = await firestore.collection("trips").get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Trip[];
  }

  async getDriverTripHistory(userId: string): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("assignedDriverId", "==", userId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((trip: any) => trip.status !== "available") as Trip[];
  }

  async getDriverActualTrips(userId: string): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("assignedDriverId", "==", userId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (trip: any) => trip.status === "accepted" || trip.status === "started"
      ) as Trip[];
  }

  async assignDriver(tripId: string, driverId: string): Promise<void> {
    const tripRef = firestore.collection("trips").doc(tripId);

    await firestore.runTransaction(async (transaction) => {
      const tripDoc = await transaction.get(tripRef);

      if (!tripDoc.exists) {
        throw new Error("El viaje solicitado no existe");
      }

      const tripData = tripDoc.data();
      if (tripData?.status !== "available") {
        throw new Error(
          `El viaje ${tripData?.tripNumber || tripId} ya fue tomado por otro conductor.`
        );
      }

      transaction.update(tripRef, {
        status: "accepted",
        assignedDriverId: driverId,
        acceptedAt: new Date().toISOString(),
      });
    });
  }

  async updateTripStatus(tripId: string, status: string): Promise<void> {
    if (status === "completed") {
      await this.completeTrip(tripId);
    } else if (status === "available") {
      await firestore.collection("trips").doc(tripId).update({
        status: "available",
        assignedDriverId: "",
      });
    } else {
      await firestore.collection("trips").doc(tripId).update({
        status: status,
      });
    }
  }

  async completeTrip(tripId: string): Promise<void> {
    await firestore.runTransaction(async (transaction) => {
      const tripRef = firestore.collection("trips").doc(tripId);
      const tripSnap = await transaction.get(tripRef);

      if (!tripSnap.exists) {
        throw new Error("Viaje no encontrado");
      }

      const tripData = tripSnap.data() as Trip;

      // Idempotencia: Si el viaje ya se encuentra completado, no volver a aplicar cambios
      if (tripData.status === "completed") {
        return;
      }

      const orderIds = tripData.orderIds || [];

      // 1. Leer todas las órdenes de forma atómica dentro de la transacción
      const orderRefs = orderIds.map((id) => firestore.collection("orders").doc(id));
      const orderSnaps = await Promise.all(orderRefs.map((ref) => transaction.get(ref)));

      // 2. Validar que todas las entregas estén marcadas como "delivered"
      for (let i = 0; i < orderSnaps.length; i++) {
        const orderSnap = orderSnaps[i];
        if (orderSnap.exists) {
          const orderData = orderSnap.data();
          const deliveries = orderData?.deliveries || [];

          const allDelivered =
            deliveries.length > 0 &&
            deliveries.every(
              (del: any) => del.status === "delivered" || del.delivered === true
            );

          if (!allDelivered) {
            throw new Error(
              "No se puede completar el viaje: hay entregas pendientes"
            );
          }
        }
      }

      // 3. Actualizar el viaje a "completed"
      transaction.update(tripRef, { status: "completed" });

      // 4. Completar las órdenes cuyos repartos estén 100% entregados
      for (let i = 0; i < orderSnaps.length; i++) {
        const orderSnap = orderSnaps[i];
        if (orderSnap.exists) {
          const orderData = orderSnap.data();
          const deliveries = orderData?.deliveries || [];

          const allDelivered =
            deliveries.length > 0 &&
            deliveries.every(
              (del: any) => del.status === "delivered" || del.delivered === true
            );

          if (allDelivered && orderData?.status !== "completed") {
            transaction.update(orderRefs[i], { status: "completed" });
          }
        }
      }
    });
  }

  async getById(tripId: string): Promise<Trip | null> {
    const doc = await firestore.collection("trips").doc(tripId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Trip;
  }

  async getByIdWithOrders(tripId: string): Promise<Trip & { orders: any[] }> {
    const tripSnap = await firestore.collection("trips").doc(tripId).get();

    if (!tripSnap.exists) {
      throw new Error("Viaje no encontrado");
    }

    const tripData = tripSnap.data() as Trip;

    let driverData: any = null;
    const assignedDriverId = tripData.assignedDriverId;

    if (assignedDriverId) {
      const driverSnap = await firestore
        .collection("users")
        .doc(assignedDriverId)
        .get();
      if (driverSnap.exists) {
        driverData = {
          id: driverSnap.id,
          ...driverSnap.data(),
        };
      }
    }

    let orders: any[] = [];

    if (tripData.orderIds && tripData.orderIds.length > 0) {
      const chunks = this.chunkArray(tripData.orderIds, 10);

      for (const chunk of chunks) {
        const ordersSnap = await firestore
          .collection("orders")
          .where(FieldPath.documentId(), "in", chunk)
          .get();

        const chunkOrders = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        orders.push(...chunkOrders);
      }

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      const userChunks = this.chunkArray(userIds, 10);
      const userMap = new Map<string, any>();

      for (const chunk of userChunks) {
        const userSnap = await firestore
          .collection("users")
          .where(FieldPath.documentId(), "in", chunk)
          .get();

        userSnap.docs.forEach((doc) => {
          userMap.set(doc.id, doc.data());
        });
      }

      orders = orders.map((order) => {
        const user = userMap.get(order.userId);
        return {
          ...order,
          userNames: user?.names,
          userLastNames: user?.lastNames,
          userType: user?.userType,
          userEmail: user?.email,
          userPhone: user?.phone,
        };
      });
    }

    return {
      id: tripSnap.id,
      ...tripData,
      driver: driverData,
      orders,
    };
  }

  async getTripByOrderId(orderId: string): Promise<{
    id: string;
    tripNumber: string;
    status: string;
    assignedDriverId: string;
    driver: any | null;
  } | null> {
    const tripSnap = await firestore
      .collection("trips")
      .where("orderIds", "array-contains", orderId)
      .limit(1)
      .get();

    if (tripSnap.empty) {
      return null;
    }

    const tripDoc = tripSnap.docs[0];
    const tripData = tripDoc.data();

    let driverData: any = null;
    const assignedDriverId = tripData.assignedDriverId;

    if (assignedDriverId) {
      const driverSnap = await firestore
        .collection("users")
        .doc(assignedDriverId)
        .get();
      if (driverSnap.exists) {
        driverData = {
          id: driverSnap.id,
          ...driverSnap.data(),
        };
      }
    }

    return {
      id: tripDoc.id,
      tripNumber: tripData.tripNumber,
      status: tripData.status,
      assignedDriverId,
      driver: driverData,
    };
  }

  async createWithOrders(data: {
    tripNumber: string;
    orderIds: string[];
    driverId?: string;
    totalTons: number;
    comments?: string;
    deliveries?: any[];
  }): Promise<string> {
    return await firestore.runTransaction(async (transaction) => {
      const orderRefs = data.orderIds.map((id) =>
        firestore.collection("orders").doc(id)
      );

      // 1. Lectura de todas las órdenes en la transacción
      const orderSnaps = await Promise.all(
        orderRefs.map((ref) => transaction.get(ref))
      );

      for (let i = 0; i < orderSnaps.length; i++) {
        const snap = orderSnaps[i];
        if (!snap.exists) {
          throw new Error(`Orden ${data.orderIds[i]} no encontrada`);
        }
        const orderData = snap.data();
        const items = orderData?.items || [];
        const existingDeliveries = orderData?.deliveries || [];

        // Validar disponibilidad por producto
        for (const item of items) {
          const pedida = Number(item.quantity) || 0;
          const entregada = existingDeliveries.reduce((sum: number, del: any) => {
            if (
              del.productId === item.productId &&
              (del.status === "delivered" || del.delivered === true)
            ) {
              return sum + (Number(del.quantity) || 0);
            }
            return sum;
          }, 0);
          const reservadaActiva = 0;
          const disponible = pedida - (entregada + reservadaActiva);

          if (disponible < 0) {
            throw new Error(
              `Sin disponibilidad suficiente para el producto ${item.name || item.productId} en la orden ${orderData?.orderNumber || data.orderIds[i]}`
            );
          }
        }
      }

      // 2. Creación del viaje y actualización atómica
      const tripRef = firestore.collection("trips").doc();
      const newTrip = {
        tripNumber: data.tripNumber,
        orderIds: data.orderIds,
        assignedDriverId: data.driverId || "",
        totalTons: data.totalTons,
        comments: data.comments || "",
        status: data.driverId ? "accepted" : "available",
        createdAt: new Date().toISOString(),
      };

      transaction.set(tripRef, newTrip);

      return tripRef.id;
    });
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}