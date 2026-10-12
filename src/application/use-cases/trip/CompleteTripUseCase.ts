import { TripRepository } from "../../../domain/repositories/TripRepository";

export class CompleteTripUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(
    tripId: string,
    userId?: string,
    userRole?: string,
    deliveryPin?: string
  ): Promise<void> {
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

      // Regla de seguridad estilo Uber: el chofer debe proveer el PIN del cliente
      if (!trip.deliveryPin) {
        throw new Error("El viaje no cuenta con un código de entrega asignado. Contacta al administrador.");
      }
      if (!deliveryPin || deliveryPin.trim() !== trip.deliveryPin.trim()) {
        throw new Error("Código de entrega incorrecto. Solicita al cliente el código de 4 dígitos para completar el viaje.");
      }
    }
    // Nota: El administrador (userRole === 'admin') no requiere PIN (mecanismo de contingencia)

    if (trip.status !== "started") {
      throw new Error(
        `No se puede completar el viaje: su estado actual es '${trip.status}', debe estar 'started'.`
      );
    }

    await this.tripRepo.completeTrip(tripId);
  }
}