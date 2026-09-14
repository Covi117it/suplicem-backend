import { EnrichedOrder } from "../../../domain/entities/EnrichedOrder";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export interface GetMyOrdersFilterOptions {
  search?: string;
  status?: string;
}

export class GetMyOrdersUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private userRepo: UserRepository
  ) {}

  async execute(
    userId: string,
    options?: GetMyOrdersFilterOptions
  ): Promise<EnrichedOrder[]> {
    let orders = await this.orderRepo.getByUser(userId);

    // 1. Filtrado por estado si se especifica
    if (options?.status && options.status !== "all") {
      orders = orders.filter((o) => o.status === options.status);
    }

    // 2. Filtrado por término de búsqueda (número de orden, ID o nombre de producto)
    if (options?.search) {
      const term = options.search.trim().toLowerCase();
      orders = orders.filter((order) => {
        const matchNumber = String(order.orderNumber ?? "").toLowerCase().includes(term);
        const matchId = String(order.id ?? "").toLowerCase().includes(term);
        const matchItem = order.items?.some(
          (item) => typeof item?.name === "string" && item.name.toLowerCase().includes(term)
        );
        return matchNumber || matchId || matchItem;
      });
    }

    // 3. Ordenamiento en el servidor: Pendientes primero, luego por número de orden descendente
    orders.sort((a, b) => {
      const aPending = a.status === "pending";
      const bPending = b.status === "pending";

      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      const numA = Number(a.orderNumber ?? 0);
      const numB = Number(b.orderNumber ?? 0);
      return numB - numA;
    });

    // 4. Enriquecer con los datos del usuario (consultando el usuario UNA sola vez)
    const user = await this.userRepo.getById(userId);

    return orders.map((order) => ({
      ...order,
      userNames: user?.names,
      userLastNames: user?.lastNames,
    }));
  }
}