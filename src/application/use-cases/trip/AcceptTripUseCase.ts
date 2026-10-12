import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class AcceptTripUseCase {
  constructor(
    private tripRepo: TripRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(tripId: string, driverId: string): Promise<{ alreadyAccepted?: boolean }> {
    if (!tripId || !driverId) {
      throw new Error("ID del viaje o del conductor faltante");
    }

    const trip = await this.tripRepo.getById(tripId);
    if (!trip) {
      const err: any = new Error("El viaje no existe");
      err.statusCode = 404;
      throw err;
    }

    if (trip.status !== "available" && trip.status !== "assigned") {
      if (
        trip.status === "accepted" &&
        (trip.assignedDriverId === driverId || (trip as any).driverId === driverId)
      ) {
        return { alreadyAccepted: true };
      }

      const err: any = new Error(
        `El viaje ${trip.tripNumber || tripId} ya no está disponible (estado: ${trip.status})`
      );
      err.statusCode = 403;
      throw err;
    }

    if (
      trip.assignedDriverId &&
      trip.assignedDriverId !== "" &&
      trip.assignedDriverId !== driverId
    ) {
      const err: any = new Error("Este viaje fue asignado específicamente a otro conductor");
      err.statusCode = 403;
      throw err;
    }

    // Validación de Capacidad del Vehículo (Evita sobrecarga)
    if (this.userRepo) {
      const driver = await this.userRepo.getById(driverId);
      const driverCapacity = Number(driver?.vehicle?.tons) || 0;
      const tripTons = Number(trip.totalTons) || 0;

      if (driverCapacity > 0 && tripTons > driverCapacity) {
        const err: any = new Error(
          `La carga del viaje (${tripTons} t) supera la capacidad máxima de tu camión (${driverCapacity} t).`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    await this.tripRepo.assignDriver(tripId, driverId);
    return { alreadyAccepted: false };
  }
}

