import { firestore } from "../../config/firebase";
import { FieldPath } from "firebase-admin/firestore";
import { Trip } from "../../domain/entities/Trip";

export class TripQueryService {
  static chunkArray<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  static async getTripDetails(tripId: string): Promise<any> {
    const tripSnap = await firestore.collection("trips").doc(tripId).get();
    if (!tripSnap.exists) {
      throw new Error("Viaje no encontrado");
    }

    const tripData = tripSnap.data() as Trip;
    let driverData: any = null;

    if (tripData.assignedDriverId) {
      const driverSnap = await firestore.collection("users").doc(tripData.assignedDriverId).get();
      if (driverSnap.exists) {
        driverData = { id: driverSnap.id, ...driverSnap.data() };
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
        orders.push(...ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];
      const userChunks = this.chunkArray(userIds, 10);
      const userMap = new Map<string, any>();

      for (const chunk of userChunks) {
        const userSnap = await firestore
          .collection("users")
          .where(FieldPath.documentId(), "in", chunk)
          .get();
        userSnap.docs.forEach((d) => userMap.set(d.id, d.data()));
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

  static async getTripByOrderId(orderId: string): Promise<{
    id: string;
    tripNumber: string;
    status: string;
    assignedDriverId: string;
    driver: any | null;
  } | null> {
    const tripSnap = await firestore
      .collection("trips")
      .where("orderIds", "array-contains", orderId)
      .get();

    if (tripSnap.empty) return null;

    // Tomar solo el viaje activo que NO esté cancelado
    const activeDoc = tripSnap.docs.find((d) => d.data().status !== "canceled");
    if (!activeDoc) return null;

    const data = activeDoc.data() as Trip;
    return {
      id: activeDoc.id,
      tripNumber: data.tripNumber,
      status: data.status,
      assignedDriverId: data.assignedDriverId || "",
      driver: null,
    };
  }
}