import { Trip } from "../../../domain/entities/Trip";
import { TripRepository } from "../../../domain/repositories/TripRepository";

export class GetAvailableTripsUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(driverId?: string): Promise<Trip[]> {
    return await this.tripRepo.getAvailable(driverId);
  }
}
