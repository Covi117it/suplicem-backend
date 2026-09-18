import { UserRepository } from "../../../domain/repositories/UserRepository";
import { OrderRepository, OrderFilters } from "../../../domain/repositories/OrderRepository";
import { EnrichedOrder } from "../../../domain/entities/EnrichedOrder";

export class GetAllOrdersUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private userRepo: UserRepository
  ) {}

  async execute(filters?: OrderFilters | string): Promise<EnrichedOrder[]> {
    const orders = await this.orderRepo.getAll(filters);

    const enrichedOrders: EnrichedOrder[] = await Promise.all(
      orders.map(async (order) => {
        try {
          if (!order.userId || typeof order.userId !== "string" || !order.userId.trim()) {
            return {
              ...order,
              userNames: (order as any).userNames || "",
              userLastNames: (order as any).userLastNames || "",
            };
          }
          const user = await this.userRepo.getById(order.userId);

          return {
            ...order,
            userNames: user?.names || (order as any).userNames || "",
            userLastNames: user?.lastNames || (order as any).userLastNames || "",
          };
        } catch (error) {
          console.warn(`Error al enriquecer orden ${order.id}:`, error);
          return order as EnrichedOrder;
        }
      })
    );

    return enrichedOrders;
  }
}
