import { TripRepository } from "../../../domain/repositories/TripRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { Trip } from "../../../domain/entities/Trip";

export class SplitOrderTripsUseCase {
  constructor(
    private tripRepo: TripRepository,
    private orderRepo: OrderRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(
    orderId: string,
    trips: Array<{ totalTons: number; driverId?: string; comments?: string }>
  ): Promise<string[]> {
    if (!orderId) {
      throw new Error("ID de la orden es requerido");
    }
    if (!trips || trips.length === 0) {
      throw new Error("Debe incluir al menos un viaje en la planificación");
    }

    const order = await this.orderRepo.getById(orderId);
    if (!order) {
      throw new Error(`La orden con ID ${orderId} no fue encontrada`);
    }

    if (order.status !== "approved") {
      throw new Error("La orden debe estar en estado 'approved' para planificar sus viajes.");
    }

    // 1. Obtener viajes existentes de la orden
    const existingTrips = await this.tripRepo.getTripsByOrderId(orderId);

    // 2. Verificar que no haya viajes en tránsito o completados que entren en conflicto
    const immutableTrips = existingTrips.filter((t) =>
      ["started", "in_progress", "completed"].includes(t.status || "")
    );
    const immutableTons = immutableTrips.reduce(
      (sum, t) => sum + (Number(t.totalTons) || 0),
      0
    );
    const orderTotalTons =
      Number(order.totalTons || order.pendingBalance) || 0;
    const deliveredTons = Number(order.deliveredTons) || 0;

    const availableTons = Math.max(0, orderTotalTons - deliveredTons - immutableTons);
    const requestedTons = trips.reduce(
      (sum, t) => sum + (Number(t.totalTons) || 0),
      0
    );

    if (requestedTons > availableTons + 0.1) {
      throw new Error(
        `El tonelaje planificado (${requestedTons.toFixed(2)} t) supera el remanente disponible (${availableTons.toFixed(2)} t).`
      );
    }

    // 3. Cancelar viajes no iniciados previos (available o assigned)
    const replaceableTrips = existingTrips.filter((t) =>
      ["available", "assigned", "accepted"].includes(t.status || "")
    );
    for (const rTrip of replaceableTrips) {
      if (rTrip.id) {
        await this.tripRepo.updateTripStatus(
          rTrip.id,
          "canceled",
          "Reemplazado por nueva planificación fraccionada de viajes"
        );
      }
    }

    // 4. Crear los nuevos viajes atómicos
    const createdTripIds: string[] = [];
    const baseTripNumber = `TRIP-${order.orderNumber || orderId.slice(0, 5).toUpperCase()}`;

    for (let i = 0; i < trips.length; i++) {
      const tripData = trips[i];
      const tripNumber =
        trips.length > 1 ? `${baseTripNumber}-${i + 1}` : baseTripNumber;
      const isDriverAssigned = Boolean(
        tripData.driverId && tripData.driverId.trim() !== ""
      );
      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      const newTrip: Trip = {
        tripNumber,
        orderIds: [orderId],
        comments:
          tripData.comments ||
          `Viaje fraccionado ${i + 1} de ${trips.length} para la orden`,
        totalTons: Number(tripData.totalTons.toFixed(2)),
        status: isDriverAssigned ? "assigned" : "available",
        assignedDriverId: tripData.driverId || undefined,
        createdAt: new Date().toISOString(),
        deliveryPin: generatedPin,
      };

      const newId = await this.tripRepo.createTripAtomic(newTrip, [orderId]);
      createdTripIds.push(newId);
    }

    return createdTripIds;
  }
}
