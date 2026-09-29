import { TripRepository } from "../../../domain/repositories/TripRepository";

export class GetTripDetailsUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(tripId: string, authUser?: { uid: string; userType: string }): Promise<any> {
    const trip = await this.tripRepo.getByIdWithOrders(tripId);
    if (!trip) return null;

    if (authUser && authUser.userType !== "admin") {
      if (authUser.userType === "driver") {
        const assignedDriver =
          trip.assignedDriverId || (trip as any).driverId || trip.driver?.id || trip.driver?.uid;
        if (assignedDriver !== authUser.uid && trip.status !== "available") {
          throw new Error("No tienes permiso para ver los detalles de este viaje.");
        }
      } else if (authUser.userType === "client") {
        const hasMyOrder = trip.orders?.some((o: any) => o.userId === authUser.uid);
        if (!hasMyOrder) {
          throw new Error("No tienes permiso para ver los detalles de este viaje.");
        }
      }
    }

    return trip;
  }
}
