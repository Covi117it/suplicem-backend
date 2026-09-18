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
    comments?: string;
    totalTons?: number;
  }): Promise<string> {
    if (!data.tripNumber || !data.orderIds?.length) {
      throw new Error("El número de viaje y al menos una orden son requeridos.");
    }

    let calculatedTotalTons = 0;

    for (const orderId of data.orderIds) {
      const order = await this.orderRepo.getById(orderId);
      if (!order) {
        throw new Error(`La orden con ID ${orderId} no fue encontrada.`);
      }

      if (order.status !== "approved") {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no puede incluirse en un viaje porque su estado es '${order.status}' (debe estar 'approved').`
        );
      }

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

      const orderTons = order.deliveries.reduce(
        (sum, delivery) => sum + (Number(delivery.quantity) || 0),
        0
      );

      if (orderTons <= 0) {
        throw new Error(
          `La orden #${order.orderNumber || orderId} tiene entregas pero el total de toneladas es 0.`
        );
      }

      calculatedTotalTons += orderTons;
    }

    if (calculatedTotalTons <= 0) {
      throw new Error("El total de toneladas calculado para el viaje debe ser mayor a 0.");
    }

    const newTrip: Trip = {
      tripNumber: data.tripNumber,
      orderIds: data.orderIds,
      comments: data.comments || "",
      totalTons: calculatedTotalTons,
      status: "available",
      createdAt: new Date().toISOString(),
    };

    return await this.tripRepo.create(newTrip);
  }
}