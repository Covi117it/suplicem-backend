import { OrderRepository } from "../../../domain/repositories/OrderRepository";

export class UpdateOrderDeliveriesUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(
    orderId: string,
    deliveryType: string,
    deliveries: any[]
  ): Promise<any> {
    if (!orderId || !deliveryType) {
      throw new Error("ID de la orden y tipo de entrega son requeridos");
    }

    return await this.orderRepo.updateDeliveries(
      orderId,
      deliveryType,
      deliveries || []
    );
  }
}
