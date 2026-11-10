import { TripRepository } from "../../../domain/repositories/TripRepository";

export class GetTripByOrderIdUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(orderId: string): Promise<{
    trip: any | null;
    trips: any[];
  }> {
    const singleTrip = await this.tripRepo.getTripByOrderId(orderId);
    const trips = await this.tripRepo.getTripsByOrderId(orderId);

    return {
      trip: singleTrip || (trips.length > 0 ? trips[0] : null),
      trips,
    };
  }
}
