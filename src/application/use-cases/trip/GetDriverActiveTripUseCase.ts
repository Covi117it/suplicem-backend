import { Trip } from "../../../domain/entities/Trip";
import { TripRepository } from "../../../domain/repositories/TripRepository";

export class GetDriverActiveTripUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(userId: string): Promise<(Trip & { orders: any[] }) | null> {
    const trips = await this.tripRepo.getDriverActualTrips(userId);

    if (!trips || trips.length === 0) {
      return null;
    }

    const activeTrip = trips[0];
    if (!activeTrip.id) {
      return null;
    }

    // Retorna el viaje activo completamente enriquecido con sus órdenes
    return await this.tripRepo.getByIdWithOrders(activeTrip.id);
  }
}