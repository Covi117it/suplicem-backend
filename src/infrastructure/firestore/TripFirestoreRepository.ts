import { firestore } from "../../config/firebase";
import { Trip } from "../../domain/entities/Trip";
import { TripRepository } from "../../domain/repositories/TripRepository";
import { TripQueryService } from "./TripQueryService";

export class TripFirestoreRepository implements TripRepository {
  async create(trip: Trip): Promise<string> {
    const docRef = await firestore.collection("trips").add(trip);
    return docRef.id;
  }

  async createTripAtomic(trip: Trip, orderIds: string[]): Promise<string> {
    return await firestore.runTransaction(async (transaction) => {
      const orderRefs = orderIds.map((id) => firestore.collection("orders").doc(id));
      const orderSnaps = await Promise.all(orderRefs.map((ref) => transaction.get(ref)));

      // 1. Verificación atómica dentro de la transacción
      for (let i = 0; i < orderSnaps.length; i++) {
        const snap = orderSnaps[i];
        const orderId = orderIds[i];

        if (!snap.exists) {
          throw new Error(`La orden con ID ${orderId} no fue encontrada.`);
        }

        const orderData = snap.data();
        if (orderData?.status !== "approved") {
          throw new Error(`La orden #${orderData?.orderNumber || orderId} no está aprobada.`);
        }

        // Nota: La validación de balance y despachos simultáneos vive en CreateTripUseCase
      }

      // 2. Crear documento de viaje
      const tripRef = firestore.collection("trips").doc();
      transaction.set(tripRef, { ...trip, id: tripRef.id });

      // 3. Vincular atómicamente cada orden y sus entregas correspondientes
      const isDriverAssigned = Boolean(trip.assignedDriverId);
      const targetTripTons = Number(trip.totalTons) || 0;

      for (let i = 0; i < orderSnaps.length; i++) {
        const orderSnap = orderSnaps[i];
        const orderData = orderSnap.data() as any;
        const deliveries = (orderData?.deliveries || []).map((d: any) => ({ ...d }));

        // Asignar tripId a las entregas pendientes que quepan en la capacidad de este viaje
        let assignedTons = 0;
        for (const del of deliveries) {
          if (!del.tripId && del.status !== "delivered") {
            const qty = Number(del.quantity) || 0;
            const dName = (del.productName || del.name || "").toLowerCase();
            const isSpecial = dName.includes("blanco") || dName.includes("especial") || dName.includes("estructural") || dName.includes("40kg") || dName.includes("40 kg");
            const factor = isSpecial ? 0.0400 : 0.0425;
            const delTons = del.unit === "fundas" ? Number((qty * factor).toFixed(2)) : qty;

            if (assignedTons + delTons <= targetTripTons + 0.5 || assignedTons === 0) {
              del.tripId = tripRef.id;
              assignedTons += delTons;
            }
          }
        }

        transaction.update(orderSnap.ref, {
          tripId: tripRef.id,
          tripStatus: isDriverAssigned ? "assigned" : "available",
          assignedDriverId: trip.assignedDriverId || "",
          driverId: trip.assignedDriverId || "",
          deliveries,
          updatedAt: new Date().toISOString(),
        });
      }

      return tripRef.id;
    });
  }

  async getAvailable(driverId?: string): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("status", "in", ["available", "assigned"])
      .get();

    let trips = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Trip[];

    if (driverId) {
      trips = trips.filter(
        (t: any) =>
          (t.status === "available" && (!t.assignedDriverId || t.assignedDriverId === "" || t.assignedDriverId === driverId || t.driverId === driverId)) ||
          (t.status === "assigned" && (t.assignedDriverId === driverId || t.driverId === driverId))
      );

      // Priorizar asignados al conductor de primero, y luego los más antiguos primero (FIFO)
      trips.sort((a: any, b: any) => {
        const aMine = a.assignedDriverId === driverId || a.driverId === driverId;
        const bMine = b.assignedDriverId === driverId || b.driverId === driverId;
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
    } else {
      // Para consultas generales, también ordenar los más antiguos primero (FIFO)
      trips.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }

    return trips;
  }

  async getAll(): Promise<Trip[]> {
    const snapshot = await firestore.collection("trips").get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Trip[];
  }

  async getById(tripId: string): Promise<Trip | null> {
    const doc = await firestore.collection("trips").doc(tripId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Trip;
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

    let trips = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((trip: any) => ["accepted", "started", "in_progress"].includes(trip.status)) as Trip[];

    if (trips.length === 0) {
      const driverSnapshot = await firestore
        .collection("trips")
        .where("driverId", "==", userId)
        .get();
      trips = driverSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((trip: any) => ["accepted", "started", "in_progress"].includes(trip.status)) as Trip[];
    }

    return trips;
  }

  async assignDriver(tripId: string, driverId: string): Promise<void> {
    const tripRef = firestore.collection("trips").doc(tripId);

    await firestore.runTransaction(async (transaction) => {
      const tripDoc = await transaction.get(tripRef);
      if (!tripDoc.exists) throw new Error("El viaje solicitado no existe");

      const tripData = tripDoc.data();
      if (tripData?.status !== "available" && tripData?.status !== "assigned") {
        if (tripData?.status === "accepted" && (tripData?.assignedDriverId === driverId || tripData?.driverId === driverId)) {
          return;
        }
        throw new Error(`El viaje ${tripData?.tripNumber || tripId} ya fue tomado por otro conductor.`);
      }

      if (tripData?.assignedDriverId && tripData.assignedDriverId !== "" && tripData.assignedDriverId !== driverId) {
        throw new Error("Este viaje fue asignado específicamente a otro conductor");
      }

      transaction.update(tripRef, {
        status: "accepted",
        assignedDriverId: driverId,
        driverId: driverId,
        acceptedAt: new Date().toISOString(),
      });

      const orderIds = tripData?.orderIds || [];
      for (const oId of orderIds) {
        const orderRef = firestore.collection("orders").doc(oId);
        transaction.update(orderRef, {
          assignedDriverId: driverId,
          driverId: driverId,
          tripId: tripId,
          tripStatus: "accepted",
        });
      }
    });
  }

  async updateTripStatus(tripId: string, status: string, cancellationReason?: string): Promise<void> {
    if (status === "completed") {
      await this.completeTrip(tripId);
    } else if (status === "available" || status === "canceled") {
      const tripDoc = await firestore.collection("trips").doc(tripId).get();
      const tripData = tripDoc.data();

      const tripUpdate: any = {
        status: status,
        assignedDriverId: "",
        driverId: "",
      };

      if (status === "canceled" && cancellationReason) {
        tripUpdate.cancellationReason = cancellationReason;
      }

      await firestore.collection("trips").doc(tripId).update(tripUpdate);

      const orderIds = tripData?.orderIds || [];
      for (const oId of orderIds) {
        // Al cancelar viaje, se limpia tripId en las órdenes para liberarlas
        await firestore.collection("orders").doc(oId).update({
          tripId: status === "canceled" ? null : tripId,
          tripStatus: "available",
          assignedDriverId: "",
          driverId: "",
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      await firestore.collection("trips").doc(tripId).update({ status });
      if (status === "started" || status === "in_progress") {
        const tripDoc = await firestore.collection("trips").doc(tripId).get();
        const tripData = tripDoc.data();
        const orderIds = tripData?.orderIds || [];
        for (const oId of orderIds) {
          await firestore.collection("orders").doc(oId).update({
            status: "on_the_way",
            tripStatus: "started",
          });
        }
      }
    }
  }

  async completeTrip(tripId: string): Promise<void> {
    await firestore.runTransaction(async (transaction) => {
      const tripRef = firestore.collection("trips").doc(tripId);
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists) throw new Error("Viaje no encontrado");

      const tripData = tripSnap.data() as Trip;
      if (tripData.status === "completed") return;

      const orderIds = tripData.orderIds || [];
      const orderRefs = orderIds.map((id) => firestore.collection("orders").doc(id));
      const orderSnaps = await Promise.all(orderRefs.map((ref) => transaction.get(ref)));

      const tripTons = Number(tripData.totalTons) || 0;
      transaction.update(tripRef, { status: "completed" });

      for (const orderSnap of orderSnaps) {
        if (orderSnap.exists) {
          const orderData = orderSnap.data() as any;
          const currentDelivered = Number(orderData.deliveredTons) || 0;
          const orderTotalTons = Number(orderData.totalTons) || (currentDelivered + tripTons);
          const newDelivered = Number((currentDelivered + tripTons).toFixed(2));
          const newPendingBalance = Number(Math.max(0, orderTotalTons - newDelivered).toFixed(2));

          const deliveries = (orderData.deliveries || []).map((d: any) => ({ ...d }));

          if (newPendingBalance <= 0) {
            // Cierre Final Definitivo: toda la orden fue entregada
            const completedDeliveries = deliveries.map((d: any) => ({
              ...d,
              status: "delivered",
              delivered: true,
            }));

            transaction.update(orderSnap.ref, {
              status: "completed",
              tripStatus: "completed",
              deliveredTons: orderTotalTons,
              pendingBalance: 0,
              deliveries: completedDeliveries,
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Entrega Fraccionada: se descuenta la fracción, pero la orden sigue activa en estado parcial
            transaction.update(orderSnap.ref, {
              status: "approved",
              tripStatus: "partial_delivered",
              deliveredTons: newDelivered,
              pendingBalance: newPendingBalance,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    });
  }

  async getByIdWithOrders(tripId: string): Promise<Trip & { orders: any[] }> {
    return await TripQueryService.getTripDetails(tripId);
  }

  async getTripDetails(tripId: string): Promise<any> {
    return await TripQueryService.getTripDetails(tripId);
  }

  async getTripByOrderId(orderId: string): Promise<{
    id: string;
    tripNumber: string;
    status: string;
    assignedDriverId: string;
    driver: any | null;
    deliveryPin?: string;
  } | null> {
    return await TripQueryService.getTripByOrderId(orderId);
  }

  async getTripsByOrderId(orderId: string): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("orderIds", "array-contains", orderId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Trip))
      .filter((trip) => trip.status !== "canceled");
  }

  async getDriverActiveTrip(driverId: string): Promise<Trip | null> {
    const snapshot = await firestore
      .collection("trips")
      .where("assignedDriverId", "==", driverId)
      .get();

    const trips = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((trip: any) => ["accepted", "started", "in_progress"].includes(trip.status)) as Trip[];

    return trips.length > 0 ? trips[0] : null;
  }
}