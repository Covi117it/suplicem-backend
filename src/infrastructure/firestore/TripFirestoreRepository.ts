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

        // Si ya tiene un viaje asociado, verificar si está activo o cancelado
        if (orderData?.tripId) {
          const linkedTripRef = firestore.collection("trips").doc(orderData.tripId);
          const linkedTripSnap = await transaction.get(linkedTripRef);
          if (linkedTripSnap.exists && linkedTripSnap.data()?.status !== "canceled") {
            throw new Error(
              `La orden #${orderData?.orderNumber || orderId} ya se encuentra asignada al viaje ${linkedTripSnap.data()?.tripNumber || orderData.tripId}.`
            );
          }
        }
      }

      // 2. Crear documento de viaje
      const tripRef = firestore.collection("trips").doc();
      transaction.set(tripRef, { ...trip, id: tripRef.id });

      // 3. Vincular atómicamente cada orden de inmediato
      const isDriverAssigned = Boolean(trip.assignedDriverId);
      for (const orderRef of orderRefs) {
        transaction.update(orderRef, {
          tripId: tripRef.id,
          tripStatus: isDriverAssigned ? "accepted" : "available",
          assignedDriverId: trip.assignedDriverId || "",
          driverId: trip.assignedDriverId || "",
          updatedAt: new Date().toISOString(),
        });
      }

      return tripRef.id;
    });
  }

  async getAvailable(driverId?: string): Promise<Trip[]> {
    const snapshot = await firestore
      .collection("trips")
      .where("status", "==", "available")
      .get();

    let trips = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Trip[];

    if (driverId) {
      trips = trips.filter(
        (t: any) =>
          !t.assignedDriverId ||
          t.assignedDriverId === "" ||
          t.assignedDriverId === driverId ||
          (t.driverId && t.driverId === driverId)
      );
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
      if (tripData?.status !== "available") {
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

  async updateTripStatus(tripId: string, status: string): Promise<void> {
    if (status === "completed") {
      await this.completeTrip(tripId);
    } else if (status === "available" || status === "canceled") {
      const tripDoc = await firestore.collection("trips").doc(tripId).get();
      const tripData = tripDoc.data();

      await firestore.collection("trips").doc(tripId).update({
        status: status,
        assignedDriverId: "",
        driverId: "",
      });

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

      for (const orderSnap of orderSnaps) {
        if (orderSnap.exists) {
          const deliveries = orderSnap.data()?.deliveries || [];
          const allDelivered = deliveries.length > 0 && deliveries.every(
            (del: any) => del.status === "delivered" || del.delivered === true
          );
          if (!allDelivered) {
            throw new Error("No se puede completar el viaje: hay entregas pendientes");
          }
        }
      }

      transaction.update(tripRef, { status: "completed" });
      for (const orderSnap of orderSnaps) {
        if (orderSnap.exists) {
          transaction.update(orderSnap.ref, {
            status: "completed",
            tripStatus: "completed",
          });
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
  } | null> {
    return await TripQueryService.getTripByOrderId(orderId);
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