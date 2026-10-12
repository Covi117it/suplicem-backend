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

    // Filtrar: los viajes asignados a él directamente los ve siempre;
    // los de la bolsa general solo si la carga no excede la capacidad de su camión
    return trips.filter((trip) => {
      const isMine = trip.assignedDriverId === driverId || (trip as any).driverId === driverId;
      if (isMine) return true;

      const tripTons = Number(trip.totalTons) || 0;
      // Si el viaje no especifica tonelaje, se permite; si especifica, debe caber en el camión
      return tripTons <= 0 || tripTons <= driverCapacity;
    });
  }
}
