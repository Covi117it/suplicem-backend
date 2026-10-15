import { TripRepository } from "../../../domain/repositories/TripRepository";

export class UpdateTripStatusUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(
    tripId: string,
    targetStatus: string,
    userId?: string,
    userRole?: string,
    cancellationReason?: string,
    deliveryPin?: string
  ): Promise<void> {
    if (!tripId || !targetStatus) {
      throw new Error("ID del viaje o status faltante.");
    }
    if (targetStatus === "canceled" && (!cancellationReason || !cancellationReason.trim())) {
      throw new Error("Se requiere un motivo o comentario para cancelar el viaje.");
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
        throw new Error("No tienes permiso para modificar este viaje porque no eres el conductor asignado.");
      }
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
      assigned: ["accepted", "canceled", "started", "available", "in_progress"],
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

    if (targetStatus === "started" || targetStatus === "in_progress") {
      if (!assignedDriver) {
        throw new Error("No se puede iniciar el viaje porque no tiene un conductor asignado.");
      }

      // Regla de concurrencia: El conductor no puede tener más de un viaje en curso al mismo tiempo
      const driverTrips = await this.tripRepo.getDriverActualTrips(assignedDriver);
      const activeRunningTrip = driverTrips.find(
        (t) =>
          t.id !== tripId &&
          (t.status === "started" || t.status === "in_progress")
      );

      if (activeRunningTrip) {
        const tripNum = activeRunningTrip.tripNumber || activeRunningTrip.id;
        throw new Error(
          `Ya tienes el viaje #${tripNum} en curso. Debes completarlo o cancelarlo antes de iniciar otro.`
        );
      }
    }

    // 4. Regla de seguridad estilo Uber para completar la entrega
    if (targetStatus === "completed") {
      // Si quien completa es el conductor, debe proveer obligatoriamente el PIN del cliente
      if (userRole === "driver") {
        if (!trip.deliveryPin) {
          throw new Error("El viaje no cuenta con un código de entrega asignado. Contacta al administrador.");
        }
        if (!deliveryPin || deliveryPin.trim() !== trip.deliveryPin.trim()) {
          throw new Error("Código de entrega inválido. Solicita al cliente el código de 4 dígitos para completar el viaje.");
        }
      }
      // Nota: Si es admin (userRole === 'admin'), se autoriza la finalización directa como mecanismo de contingencia.
    }

    // 5. Aplicar la actualización
    await this.tripRepo.updateTripStatus(tripId, targetStatus, cancellationReason);
  }
}