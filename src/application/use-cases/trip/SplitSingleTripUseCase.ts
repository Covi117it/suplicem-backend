import { TripRepository } from "../../../domain/repositories/TripRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { Trip } from "../../../domain/entities/Trip";

export class SplitSingleTripUseCase {
  constructor(
    private tripRepo: TripRepository,
    private orderRepo: OrderRepository
  ) {}

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
    if (trip.status !== "available" && trip.status !== "assigned") {
      throw new Error(`No se puede fraccionar un viaje en estado '${trip.status}'`);
    }

    const tripTons = Number(trip.totalTons) || 0;
    const requestedTons = subTrips.reduce((sum, t) => sum + (Number(t.totalTons) || 0), 0);
    if (requestedTons > tripTons + 0.1) {
      throw new Error(
        `El tonelaje dividido (${requestedTons.toFixed(2)} t) supera la carga del viaje original (${tripTons.toFixed(2)} t).`
      );
    }

    // 1. Cancelar el viaje original
    await this.tripRepo.updateTripStatus(tripId, "canceled", "Dividido en sub-viajes fraccionados");

    // 2. Crear los nuevos sub-viajes vinculados a las órdenes originales
    const orderIds =
      trip.orderIds && trip.orderIds.length > 0
        ? trip.orderIds
        : (trip as any).orderId
        ? [(trip as any).orderId]
        : [];

    if (orderIds.length === 0) {
      throw new Error("El viaje no tiene órdenes asociadas para fraccionar");
    }

    const createdTripIds: string[] = [];

    for (let i = 0; i < subTrips.length; i++) {
      const item = subTrips[i];
      const tripNumber = `${trip.tripNumber}-${String.fromCharCode(65 + i)}`;
      const isAssigned = Boolean(item.driverId && item.driverId.trim() !== "");
      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      const newTrip: Trip = {
        tripNumber,
        orderIds,
        comments: item.comments || `Fracción ${i + 1} de ${trip.tripNumber}`,
        totalTons: Number(item.totalTons.toFixed(2)),
        status: isAssigned ? "assigned" : "available",
        assignedDriverId: item.driverId || undefined,
        createdAt: new Date().toISOString(),
        deliveryPin: generatedPin,
      };

      const newId = await this.tripRepo.createTripAtomic(newTrip, orderIds);
      createdTripIds.push(newId);
    }

    return createdTripIds;
  }
}
