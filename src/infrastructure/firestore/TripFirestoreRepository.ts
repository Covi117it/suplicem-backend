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
    await firestore.collection("trips").doc(tripId).update({
      status: status,
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

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}