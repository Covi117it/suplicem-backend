import { TripRepository } from "../../../domain/repositories/TripRepository";

export class GetTripByOrderIdUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(orderId: string): Promise<{
    trip: any | null;
    trips: any[];
  }> {
    const trips = await this.tripRepo.getTripsByOrderId(orderId);
    const activeTrip =
      trips.find((t) =>
        ["available", "accepted", "started", "in_progress"].includes(t.status)
      ) ||
      trips[0] ||
      null;

    return {
      trip: activeTrip,
      trips,
    };
  }
}
