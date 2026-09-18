import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";

export class UpdateOrderStatusUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo?: TripRepository
  ) {}

  async execute(orderId: string, status: "approved" | "rejected", reason?: string, driverId?: string): Promise<void> {
    if (status === "rejected" && !reason) {
      throw new Error("Se requiere un motivo para rechazar la orden");
    }

    await this.orderRepo.updateStatus(orderId, status, reason);

    if (status === "approved" && this.tripRepo) {
      try {
        const order = await this.orderRepo.getById(orderId);
        if (order && order.deliveryType === "domicilio") {
          const existingTrip = await this.tripRepo.getTripByOrderId(orderId);
          if (!existingTrip || existingTrip.status === "canceled") {
            const totalTons =
              (order.deliveries || []).reduce(
                (sum, d) => sum + (Number(d.quantity) || 0),
                0
              ) ||
              (order.items || []).reduce(
                (sum, item) => sum + (Number(item.quantity) || 0),
                0
              ) ||
              1;

            const tripNumber = `TRIP-${order.orderNumber || orderId.slice(0, 6).toUpperCase()}`;

            await this.tripRepo.create({
              tripNumber,
              orderIds: [orderId],
              comments: order.comments || "Entrega generada automáticamente por aprobación",
              totalTons,
              status: "available",
              assignedDriverId: driverId || "",
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (tripError) {
        console.warn("No se pudo auto-crear el viaje para la orden aprobada:", tripError);
      }
    }
  }
}
