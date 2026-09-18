import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { Order, DeliveryDetail } from "../../../domain/entities/Order";

export class UpdateOrderDeliveriesUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(
    orderId: string,
    deliveryType: "almacen" | "domicilio" | string,
    deliveries: DeliveryDetail[]
  ): Promise<Order> {
    if (!orderId || !orderId.trim()) {
      throw new Error("ID de la orden es requerido");
    }
    if (!deliveryType) {
      throw new Error("Tipo de entrega es requerido");
    }
    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      throw new Error("Debe incluir al menos una entrega");
    }

    const order = await this.orderRepo.getById(orderId);
    if (!order) {
      throw new Error("Orden no encontrada");
    }

    if (order.status === "rejected") {
      throw new Error(
        "No se pueden modificar las entregas de una orden rechazada."
      );
    }

    // 1. Validar que cada producto solicitado pertenezca a la orden
    const itemsMap = new Map<string, { name: string; quantity: number }>();
    for (const item of order.items || []) {
      itemsMap.set(item.productId, {
        name: item.name || item.productId,
        quantity: Number(item.quantity) || 0,
      });
    }

    // 2. Mapear cantidades ya entregadas previamente
    const deliveredMap = new Map<string, number>();
    for (const del of order.deliveries || []) {
      if (del.status === "delivered") {
        const current = deliveredMap.get(del.productId) || 0;
        deliveredMap.set(del.productId, current + (Number(del.quantity) || 0));
      }
    }

    // 3. Mapear la nueva asignación solicitada en la petición
    const requestedMap = new Map<string, number>();
    for (const del of deliveries) {
      if (!del.productId || !itemsMap.has(del.productId)) {
        throw new Error(
          `El producto '${del.productId}' no pertenece a los productos comprados en esta orden.`
        );
      }
      const qty = Number(del.quantity) || 0;
      if (qty <= 0) {
        throw new Error(
          `La cantidad asignada a la entrega del producto '${del.productId}' debe ser mayor a cero.`
        );
      }
      const current = requestedMap.get(del.productId) || 0;
      requestedMap.set(del.productId, current + qty);
    }

    // 4. Validar disponibilidad real: requestedQty <= (ordered - delivered)
    for (const [productId, requestedQty] of requestedMap.entries()) {
      const itemInfo = itemsMap.get(productId)!;
      const orderedQty = itemInfo.quantity;
      const alreadyDelivered = deliveredMap.get(productId) || 0;
      const available = Math.max(0, orderedQty - alreadyDelivered);

      if (requestedQty > available) {
        throw new Error(
          `La cantidad asignada (${requestedQty}) para ${itemInfo.name} supera la disponibilidad real (${available}).`
        );
      }
    }

    return await this.orderRepo.updateDeliveries(
      orderId,
      deliveryType,
      deliveries
    );
  }
}
