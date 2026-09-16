import { TripRepository } from "../../../domain/repositories/TripRepository";

export class CreateTripWithOrdersUseCase {
  constructor(private tripRepo: TripRepository) {}

  async execute(data: {
    tripNumber: string;
    orderIds: string[];
    driverId?: string;
    totalTons: number;
    comments?: string;
    deliveries?: any[];
  }): Promise<string> {
    if (!data.tripNumber || !data.orderIds?.length || !data.totalTons) {
      throw new Error("Faltan datos requeridos (tripNumber, orderIds, totalTons)");
    }

    return await this.tripRepo.createWithOrders(data);
  }
}
