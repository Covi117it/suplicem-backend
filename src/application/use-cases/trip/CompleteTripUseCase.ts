import { TripRepository } from "../../../domain/repositories/TripRepository";

export class CompleteTripUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(tripId: string): Promise<void> {
    if (!tripId) {
      throw new Error("ID del viaje faltante");
    }

    await this.tripRepo.completeTrip(tripId);
  }
}
