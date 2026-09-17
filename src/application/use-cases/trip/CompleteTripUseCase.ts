import { TripRepository } from "../../../domain/repositories/TripRepository";

export class CompleteTripUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(tripId: string): Promise<void> {
    if (!tripId) {
      throw new Error("ID del viaje faltante.");
    }

    const trip = await this.tripRepo.getById(tripId);
    if (!trip) {
      throw new Error("El viaje no fue encontrado.");
    }

    if (trip.status !== "started") {
      throw new Error(
        `No se puede completar el viaje: su estado actual es '${trip.status}', debe estar 'started'.`
      );
    }

    await this.tripRepo.completeTrip(tripId);
  }
}
