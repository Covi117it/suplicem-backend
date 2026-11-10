import { Trip } from "../../../domain/entities/Trip";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class GetAvailableTripsUseCase {
  constructor(
    private tripRepo: TripRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(driverId?: string): Promise<Trip[]> {
    const trips = await this.tripRepo.getAvailable(driverId);

    // Si quien consulta no es un chofer (ej. admin o consulta general), retornar todos los viajes
    if (!driverId || !this.userRepo) {
      return trips;
    }

    // Obtener los datos del conductor y la capacidad de su vehículo
    const driver = await this.userRepo.getById(driverId);
    const driverCapacity = Number(driver?.vehicle?.tons) || 0;

    // Si el chofer no tiene vehículo o capacidad definida, ve los viajes normalmente
    if (driverCapacity <= 0) {
      return trips;
    }

    // Un conductor solo ve los viajes que le han sido asignados directamente por administración
    return trips.filter((trip) => {
      return trip.assignedDriverId === driverId || (trip as any).driverId === driverId;
    });
  }
}
