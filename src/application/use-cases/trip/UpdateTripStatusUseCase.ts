import { TripRepository } from "../../../domain/repositories/TripRepository";

export class UpdateTripStatusUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(tripId: string, targetStatus: string): Promise<void> {
    if (!tripId || !targetStatus) {
      throw new Error("ID del viaje o status faltante.");
    }

    const trip = await this.tripRepo.getById(tripId);
    if (!trip) {
      throw new Error("El viaje no fue encontrado.");
    }

    const currentStatus = trip.status;

    // 1. Estados terminales: no admiten cambios
    if (currentStatus === "completed") {
      throw new Error("El viaje ya se encuentra finalizado y no puede cambiar de estado.");
    }
    if (currentStatus === "canceled") {
      throw new Error("El viaje está cancelado y no puede cambiar de estado.");
    }

    // 2. Matriz de transiciones permitidas
    const allowedTransitions: Record<string, string[]> = {
      available: ["accepted", "canceled"],
      accepted: ["started", "available", "canceled"],
      started: ["completed", "canceled"],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Transición no permitida: no se puede cambiar un viaje de '${currentStatus}' a '${targetStatus}'.`
      );
    }

    // 3. Regla específica para iniciar ruta: debe tener chofer asignado
    if (targetStatus === "started" && !trip.assignedDriverId) {
      throw new Error("No se puede iniciar el viaje porque no tiene un conductor asignado.");
    }

    // 4. Aplicar la actualización
    await this.tripRepo.updateTripStatus(tripId, targetStatus);
  }
}