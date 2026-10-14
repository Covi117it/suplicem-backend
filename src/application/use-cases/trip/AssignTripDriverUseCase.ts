import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class AssignTripDriverUseCase {
  constructor(
    private tripRepo: TripRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(tripId: string, driverId: string): Promise<void> {
    if (!tripId || tripId.trim() === "") {
      throw new Error("El ID del viaje es obligatorio");
    }
    if (!driverId || driverId.trim() === "") {
      throw new Error("El ID del conductor es obligatorio");
    }

    if (this.userRepo) {
      const driver = await this.userRepo.getById(driverId);
      if (!driver || driver.userType !== "driver") {
        throw new Error("El usuario especificado no es un conductor válido");
      }
    }

    await this.tripRepo.assignDriver(tripId, driverId);
  }
}
