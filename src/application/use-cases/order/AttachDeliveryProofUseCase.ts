import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";

export interface AttachDeliveryProofDto {
  orderId: string;
  index: number;
  comment?: string;
  imageUrl?: string;
  userId?: string;
  userRole?: string;
}

export class AttachDeliveryProofUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo?: TripRepository
  ) {}

  async execute(dto: AttachDeliveryProofDto): Promise<void> {
    if (!dto.orderId) {
      throw new Error("ID de orden requerido");
    }
    if (isNaN(dto.index) || dto.index < 0) {
      throw new Error("Índice de entrega inválido");
    }

    if (dto.userRole === "driver" && dto.userId && this.tripRepo) {
      let isAssigned = false;
      if (this.tripRepo.getTripsByOrderId) {
        const trips = await this.tripRepo.getTripsByOrderId(dto.orderId);
        isAssigned = trips.some((t) => {
          const driver = t.assignedDriverId || (t as any).driverId || t.driver?.id || t.driver?.uid;
          const isActive = ["accepted", "started", "in_progress"].includes(t.status);
          return isActive && driver === dto.userId;
        });
      }

      if (!isAssigned) {
        const trip = await this.tripRepo.getTripByOrderId(dto.orderId);
        const assignedDriver =
          trip?.assignedDriverId || (trip as any)?.driverId || trip?.driver?.id || trip?.driver?.uid;
        if (!trip || assignedDriver !== dto.userId) {
          throw new Error("No tienes permiso para adjuntar comprobantes en esta orden porque no eres el conductor asignado.");
        }
      }
    }

    await this.orderRepo.attachDeliveryProof(dto.orderId, dto.index, {
      comment: dto.comment,
      imageUrl: dto.imageUrl,
    });
  }
}
