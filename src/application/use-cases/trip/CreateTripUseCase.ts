import { Trip } from "../../../domain/entities/Trip";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";

export class CreateTripUseCase {
  constructor(
    private tripRepo: TripRepository,
    private orderRepo: OrderRepository
  ) {}

  async execute(data: {
    tripNumber: string;
    orderIds: string[];
    driverId?: string;
    comments?: string;
    totalTons?: number;
  }): Promise<string> {
    if (!data.tripNumber || !data.orderIds?.length) {
      throw new Error("El número de viaje y al menos una orden son requeridos.");
    }

    const uniqueOrderIds = [...new Set(data.orderIds)];
    let calculatedTotalTons = 0;

    for (const orderId of uniqueOrderIds) {
      const order = await this.orderRepo.getById(orderId);
      if (!order) {
        throw new Error(`La orden con ID ${orderId} no fue encontrada.`);
      }

      if (order.status !== "approved") {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no puede incluirse en un viaje porque su estado es '${order.status}' (debe estar 'approved').`
        );
      }

      // Validar si tiene viaje previo activo (no cancelado)
      const existingTrip = await this.tripRepo.getTripByOrderId(orderId);
      if (existingTrip && existingTrip.status !== "canceled") {
        throw new Error(
          `La orden #${order.orderNumber || orderId} ya se encuentra asignada al viaje ${existingTrip.tripNumber}.`
        );
      }

      if (!order.deliveries || order.deliveries.length === 0) {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no tiene entregas (deliveries) configuradas.`
        );
      }

      // Tonelaje real: solo sumar entregas que estén PENDIENTES de transporte
      const pendingDeliveries = order.deliveries.filter(
        (del) => del.status !== "delivered" && del.delivered !== true
      );

      const orderPendingTons = pendingDeliveries.reduce(
        (sum, delivery) => sum + (Number(delivery.quantity) || 0),
        0
      );

      if (orderPendingTons <= 0) {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no tiene tonelaje pendiente por transportar.`
        );
      }

      calculatedTotalTons += orderPendingTons;
    }

    if (calculatedTotalTons <= 0) {
      throw new Error("El total de toneladas calculado para el viaje debe ser mayor a 0.");
    }

    const isDriverAssigned = Boolean(data.driverId && data.driverId.trim() !== "");
    const newTrip: Trip = {
      tripNumber: data.tripNumber,
      orderIds: uniqueOrderIds,
      comments: data.comments || "",
      totalTons: data.totalTons && data.totalTons > 0 ? data.totalTons : calculatedTotalTons,
      assignedDriverId: isDriverAssigned ? data.driverId : "",
      status: isDriverAssigned ? "accepted" : "available",
      createdAt: new Date().toISOString(),
    };

    return await this.tripRepo.createTripAtomic(newTrip, uniqueOrderIds);
  }
}