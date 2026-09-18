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

    // Si ya se encuentra en el estado solicitado, responder exitosamente (idempotencia)
    if (currentStatus === targetStatus) {
      return;
    }

    // 1. Estados terminales: no admiten cambios
    if (currentStatus === "completed") {
      throw new Error("El viaje ya se encuentra finalizado y no puede cambiar de estado.");
    }
    if (currentStatus === "canceled") {
      throw new Error("El viaje está cancelado y no puede cambiar de estado.");
    }

    // 2. Matriz de transiciones permitidas
    const allowedTransitions: Record<string, string[]> = {
      available: ["accepted", "canceled", "started"],
      accepted: ["started", "in_progress", "available", "canceled"],
      started: ["completed", "canceled", "available", "in_progress"],
      in_progress: ["completed", "canceled", "available", "started"],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Transición no permitida: no se puede cambiar un viaje de '${currentStatus}' a '${targetStatus}'.`
      );
    }

    // 3. Regla específica para iniciar ruta: debe tener chofer asignado
    const assignedDriver =
      trip.assignedDriverId ||
      (trip as any).driverId ||
      trip.driver?.id ||
      trip.driver?.uid;

    if ((targetStatus === "started" || targetStatus === "in_progress") && !assignedDriver) {
      throw new Error("No se puede iniciar el viaje porque no tiene un conductor asignado.");
    }

    // 4. Aplicar la actualización
    await this.tripRepo.updateTripStatus(tripId, targetStatus);
  }
}