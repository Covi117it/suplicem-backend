import { OrderRepository } from "../../../domain/repositories/OrderRepository";

export class UpdateOrderReceiptUseCase {
  constructor(private orderRepository: OrderRepository) {}

  async execute(
    orderId: string,
    receiptImage: string,
    userId?: string,
    userType?: string
  ): Promise<void> {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new Error("Orden no encontrada");
    }

    if (userType === "client" && order.userId !== userId) {
      throw new Error("No tienes permiso para actualizar esta orden");
    }

    await this.orderRepository.updateReceiptImage(orderId, receiptImage);
  }
}
