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

    const tripData = { id: tripSnap.id, ...tripSnap.data() } as Trip;
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

        // 1. Numerar cada entrega con su originalIndex de Firestore
        const allDeliveriesWithIndex = (order.deliveries || []).map((d: any, idx: number) => ({
          ...d,
          originalIndex: idx,
        }));

        // 2. Filtrar entregas asignadas a este viaje específico
        let tripDeliveries = allDeliveriesWithIndex.filter(
          (d: any) => Boolean(d.tripId) && d.tripId === tripData.id
        );

        // Retrocompatibilidad con órdenes viejas sin tripId asignado:
        if (tripDeliveries.length === 0 && allDeliveriesWithIndex.length > 0) {
          let assignedTons = 0;
          const targetTripTons = Number(tripData.totalTons) || 0;

          tripDeliveries = allDeliveriesWithIndex.filter((del: any) => {
            const factor = 0.0425;
            const tons = del.unit === "fundas" ? Number((del.quantity * factor).toFixed(2)) : Number(del.quantity);
            if (assignedTons + tons <= targetTripTons + 0.5 || assignedTons === 0) {
              assignedTons += tons;
              return true;
            }
            return false;
          });
        }

        // 3. Filtrar items de la orden para reflejar solo lo que va en este camión
        const tripProductIds = new Set(tripDeliveries.map((d: any) => d.productId));
        const tripItems = (order.items || [])
          .filter((item: any) => tripProductIds.has(item.productId))
          .map((item: any) => {
            const productDeliveries = tripDeliveries.filter((d: any) => d.productId === item.productId);
            const tripQty = productDeliveries.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
            return {
              ...item,
              quantity: tripQty > 0 ? tripQty : item.quantity,
              subtotal: tripQty > 0 ? tripQty * (Number(item.unitPrice) || 0) : item.subtotal,
            };
          });

        return {
          ...order,
          deliveries: tripDeliveries,
          items: tripItems.length > 0 ? tripItems : order.items,
          tripTons: tripData.totalTons,
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
    deliveryPin?: string;
  } | null> {
    const tripSnap = await firestore
      .collection("trips")
      .where("orderIds", "array-contains", orderId)
      .get();

    if (tripSnap.empty) return null;

    // Priorizar viaje activo (en curso o disponible)
    const activeDoc =
      tripSnap.docs.find((d) =>
        ["available", "accepted", "started", "in_progress"].includes(d.data().status)
      ) ||
      tripSnap.docs.find((d) => d.data().status !== "canceled");

    if (!activeDoc) return null;

    const data = activeDoc.data() as Trip;
    return {
      id: activeDoc.id,
      tripNumber: data.tripNumber,
      status: data.status,
      assignedDriverId: data.assignedDriverId || "",
      driver: null,
      deliveryPin: data.deliveryPin,
    };
  }
}