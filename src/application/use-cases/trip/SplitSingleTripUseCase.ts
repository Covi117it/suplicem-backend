import { TripRepository } from "../../../domain/repositories/TripRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { Trip } from "../../../domain/entities/Trip";
import { selectBestDriver } from "../../../domain/services/DriverAssignmentService";

export class SplitSingleTripUseCase {
  constructor(
    private tripRepo: TripRepository,
    private orderRepo: OrderRepository,
    private userRepo?: UserRepository
  ) {}

  private async resolveDriverId(
    requiredTons: number,
    preferredDriverId?: string,
    cachedContext?: { drivers: any[]; trips: any[] }
  ): Promise<string> {
    const preferred = (preferredDriverId || "").trim();
    if (preferred) return preferred;
    if (!this.userRepo) return "";

    if (!cachedContext) {
      const [drivers, trips] = await Promise.all([
        this.userRepo.getAll({ status: "active", userType: "driver" }),
        this.tripRepo.getActiveTrips ? this.tripRepo.getActiveTrips() : this.tripRepo.getAll(),
      ]);
      return selectBestDriver(drivers, trips, requiredTons) || "";
    }

    const selected = selectBestDriver(cachedContext.drivers, cachedContext.trips, requiredTons) || "";
    if (selected) {
      cachedContext.trips.push({
        assignedDriverId: selected,
        driverId: selected,
        status: "assigned",
        totalTons: requiredTons,
      });
    }
    return selected;
  }

  async execute(
    tripId: string,
    subTrips: Array<{ totalTons: number; driverId?: string; comments?: string }>
  ): Promise<string[]> {
    if (!tripId) throw new Error("ID del viaje es requerido");
    if (!subTrips || subTrips.length < 2) {
      throw new Error("Debe dividir el viaje en al menos 2 sub-viajes");
    }

    const trip = await this.tripRepo.getById(tripId);
    if (!trip) throw new Error("Viaje no encontrado");
    if (!["available", "assigned", "accepted"].includes(trip.status)) {
      throw new Error(`No se puede fraccionar un viaje en estado '${trip.status}'`);
    }

    const tripTons = Number(trip.totalTons) || 0;
    const requestedTons = subTrips.reduce((sum, t) => sum + (Number(t.totalTons) || 0), 0);
    if (requestedTons > tripTons + 0.1) {
      throw new Error(
        `El tonelaje dividido (${requestedTons.toFixed(2)} t) supera la carga del viaje original (${tripTons.toFixed(2)} t).`
      );
    }

    // 1. Obtener órdenes asociadas al viaje
    const orderIds =
      trip.orderIds && trip.orderIds.length > 0
        ? trip.orderIds
        : (trip as any).orderId
        ? [(trip as any).orderId]
        : [];

    if (orderIds.length === 0) {
      throw new Error("El viaje no tiene órdenes asociadas para fraccionar");
    }

    // 2. Construir los nuevos sub-viajes en memoria
    const tripsToCreate: Trip[] = [];
    const needsAutoDriver = subTrips.some((t) => !(t.driverId || "").trim());
    const driverContext =
      needsAutoDriver && this.userRepo
        ? await Promise.all([
            this.userRepo.getAll({ status: "active", userType: "driver" }),
            this.tripRepo.getActiveTrips ? this.tripRepo.getActiveTrips() : this.tripRepo.getAll(),
          ]).then(([drivers, activeTrips]) => ({ drivers, trips: [...activeTrips] }))
        : undefined;

    for (let i = 0; i < subTrips.length; i++) {
      const item = subTrips[i];
      const tripNumber = `${trip.tripNumber}-${String.fromCharCode(65 + i)}`;
      const resolvedDriverId = await this.resolveDriverId(
        item.totalTons,
        item.driverId,
        driverContext
      );
      const isAssigned = resolvedDriverId !== "";
      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      tripsToCreate.push({
        tripNumber,
        orderIds,
        comments: item.comments || `Fracción ${i + 1} de ${trip.tripNumber}`,
        totalTons: Number(item.totalTons.toFixed(2)),
        status: isAssigned ? "accepted" : "available",
        assignedDriverId: resolvedDriverId || undefined,
        driverId: isAssigned ? resolvedDriverId : undefined,
        acceptedAt: isAssigned ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
        deliveryPin: generatedPin,
      });
    }

    // 3. Ejecutar cancelación y creación atómica indivisible (Todo o Nada)
    if (this.tripRepo.createSplitTripsAtomic) {
      return await this.tripRepo.createSplitTripsAtomic(orderIds[0], tripsToCreate, [tripId]);
    }

    // Fallback retrocompatible para mocks de tests unitarios
    await this.tripRepo.updateTripStatus(tripId, "canceled", "Dividido en sub-viajes fraccionados");
    const createdTripIds: string[] = [];
    for (const newTrip of tripsToCreate) {
      const newId = await this.tripRepo.createTripAtomic(newTrip, orderIds);
      createdTripIds.push(newId);
    }
    return createdTripIds;
  }
}
