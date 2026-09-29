import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";

export interface CompleteDeliveryDto {
  orderId: string;
  index: number;
  comment?: string;
  imageUrl?: string;
  userId?: string;
  userRole?: string;
}

export class MarkDeliveryCompletedUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo?: TripRepository
  ) {}

  async execute(
    orderIdOrDto: string | CompleteDeliveryDto,
    index?: number
  ): Promise<void> {
    const orderId = typeof orderIdOrDto === "object" ? orderIdOrDto.orderId : orderIdOrDto;
    const deliveryIndex = typeof orderIdOrDto === "object" ? orderIdOrDto.index : (index ?? 0);
    const userId = typeof orderIdOrDto === "object" ? orderIdOrDto.userId : undefined;
    const userRole = typeof orderIdOrDto === "object" ? orderIdOrDto.userRole : undefined;

    // Validación BOLA/IDOR: Si es conductor, debe ser el conductor asignado al viaje de esta orden
    if (userRole === "driver" && userId && this.tripRepo) {
      const trip = await this.tripRepo.getTripByOrderId(orderId);
      const assignedDriver =
        trip?.assignedDriverId || (trip as any)?.driverId || trip?.driver?.id || trip?.driver?.uid;
      if (!trip || assignedDriver !== userId) {
        throw new Error("No tienes permiso para completar entregas en esta orden porque no eres el conductor asignado.");
      }
    }

    if (typeof orderIdOrDto === "object") {
      await this.orderRepo.completeDelivery(
        orderId,
        deliveryIndex,
        {
          comment: orderIdOrDto.comment,
          imageUrl: orderIdOrDto.imageUrl,
        }
      );
    } else {
      await this.orderRepo.completeDelivery(orderId, deliveryIndex, {});
    }
  }
}