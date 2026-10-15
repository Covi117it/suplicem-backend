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

    // Validación de Capacidad Acumulada del Vehículo (Evita sobrecarga considerando viajes activos)
    if (this.userRepo) {
      const driver = await this.userRepo.getById(driverId);
      const driverCapacity = Number(driver?.vehicle?.tons) || 0;
      const tripTons = Number(trip.totalTons) || 0;

      if (driverCapacity > 0) {
        const activeTrips = await this.tripRepo.getDriverActualTrips(driverId);
        // Excluir este mismo viaje en caso de reintento
        const otherTrips = activeTrips.filter((t) => t.id !== tripId);
        const currentCommittedTons = otherTrips.reduce(
          (sum, t) => sum + (Number(t.totalTons) || 0),
          0
        );
        const totalTonsWithNewTrip = currentCommittedTons + tripTons;

        if (totalTonsWithNewTrip > driverCapacity) {
          const err: any = new Error(
            currentCommittedTons > 0
              ? `No puedes aceptar este viaje (${tripTons} t). Ya tienes asignadas ${currentCommittedTons.toFixed(2)} t y la suma (${totalTonsWithNewTrip.toFixed(2)} t) supera la capacidad máxima de tu camión (${driverCapacity} t).`
              : `La carga del viaje (${tripTons} t) supera la capacidad máxima de tu camión (${driverCapacity} t).`
          );
          err.statusCode = 400;
          throw err;
        }
      }
    }

    await this.tripRepo.acceptTrip(tripId, driverId);
    return { alreadyAccepted: false };

  }
}

