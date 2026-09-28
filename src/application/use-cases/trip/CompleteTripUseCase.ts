import { TripRepository } from "../../../domain/repositories/TripRepository";

export class CompleteTripUseCase {
  constructor(private tripRepo: TripRepository) {}

    async execute(tripId: string, userId?: string, userRole?: string): Promise<void> {
    if (!tripId) {
      throw new Error("ID del viaje faltante.");
    }

    const trip = await this.tripRepo.getById(tripId);
    if (!trip) {
      throw new Error("El viaje no fue encontrado.");
    }

    if (userRole === "driver") {
      const assignedDriver =
        trip.assignedDriverId ||
        (trip as any).driverId ||
        trip.driver?.id ||
        trip.driver?.uid;

      if (assignedDriver !== userId) {
        throw new Error("No tienes permiso para completar este viaje porque no eres el conductor asignado.");
      }
    }

    if (trip.status !== "started") {
      throw new Error(
        `No se puede completar el viaje: su estado actual es '${trip.status}', debe estar 'started'.`
      );
    }

    await this.tripRepo.completeTrip(tripId);
  }
}
