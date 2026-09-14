import { Order } from "../entities/Order";

export interface OrderRepository {
  create(order: Order): Promise<{ orderId: string; orderNumber: number }>;
  getByUser(userId: string): Promise<Order[]>;
  getById(orderId: string): Promise<Order | null>;
  getAll(status?: string): Promise<Order[]>;
  getNextOrderNumber(): Promise<number>;
  updateStatus(
    orderId: string,
    status: "approved" | "rejected",
    reason?: string
  ): Promise<void>;
  markDeliveryAsCompleted(orderId: string, index: number): Promise<void>;

  completeDelivery(
    orderId: string,
    index: number,
    data: { comment?: string; imageUrl?: string }
  ): Promise<void>;
  markDeliveryAsCompleted(orderId: string, index: number): Promise<void>;
}
