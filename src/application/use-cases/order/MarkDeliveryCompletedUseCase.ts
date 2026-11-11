import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { NotificationDispatcherService } from "../../services/NotificationDispatcherService";

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
    private tripRepo?: TripRepository,
    private userRepo?: UserRepository,
    private notificationDispatcher?: NotificationDispatcherService
  ) {}

  async execute(
    orderIdOrDto: string | CompleteDeliveryDto,
    index?: number
  ): Promise<void> {
    const orderId = typeof orderIdOrDto === "object" ? orderIdOrDto.orderId : orderIdOrDto;
    const deliveryIndex = typeof orderIdOrDto === "object" ? orderIdOrDto.index : (index ?? 0);
    const userId = typeof orderIdOrDto === "object" ? orderIdOrDto.userId : undefined;
    const userRole = typeof orderIdOrDto === "object" ? orderIdOrDto.userRole : undefined;

    // Validación BOLA/IDOR: Si es conductor, debe ser el conductor asignado a un viaje activo de esta orden
    if (userRole === "driver" && userId && this.tripRepo) {
      let isAssigned = false;
      if (this.tripRepo.getTripsByOrderId) {
        const trips = await this.tripRepo.getTripsByOrderId(orderId);
        isAssigned = trips.some((t) => {
          const driver = t.assignedDriverId || (t as any).driverId || t.driver?.id || t.driver?.uid;
          const isActive = ["accepted", "started", "in_progress"].includes(t.status);
          return isActive && driver === userId;
        });
      }

      if (!isAssigned) {
        const trip = await this.tripRepo.getTripByOrderId(orderId);
        const assignedDriver =
          trip?.assignedDriverId || (trip as any)?.driverId || trip?.driver?.id || trip?.driver?.uid;
        if (!trip || assignedDriver !== userId) {
          throw new Error("No tienes permiso para completar entregas en esta orden porque no eres el conductor asignado.");
        }
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

    if (this.notificationDispatcher) {
      Promise.all([
        this.orderRepo.getById(orderId),
        userId && this.userRepo ? this.userRepo.getById(userId) : Promise.resolve(null),
      ])
        .then(([order, actor]) => {
          const sellerId = order?.sellerId || order?.createdBySellerId;
          if (!order || !sellerId) return;

          const driverName = actor
            ? `${actor.names || ""} ${actor.lastNames || ""}`.trim() || "Conductor"
            : "Conductor";
          const clientName = `${order.userNames || ""} ${order.userLastNames || ""}`.trim() || "Cliente";

          return this.notificationDispatcher!.notifyDeliveryCompleted({
            sellerId,
            driverName,
            clientName,
            orderNumber: order.orderNumber,
            details: `Entrega #${deliveryIndex + 1} completada`,
          });
        })
        .catch((err) =>
          console.warn("[Notification] Error al notificar entrega de orden:", err?.message || err)
        );
    }
  }
}