import { UserRepository } from "../../../domain/repositories/UserRepository";
import { OrderRepository, OrderFilters } from "../../../domain/repositories/OrderRepository";
import { EnrichedOrder } from "../../../domain/entities/EnrichedOrder";

export interface PaginatedOrdersQuery {
  status?: string;
  deliveryType?: string;
  userId?: string;
  withoutTrip?: boolean;
  sellerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedOrdersResult {
  orders: EnrichedOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  orderCounts: Record<string, number>;
  kpis: {
    pendingCount: number;
    pendingAmount: number;
    inRouteCount: number;
    approvedCount: number;
    aiRiskCount: number;
  };
}

export class GetAllOrdersUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private userRepo: UserRepository
  ) {}

  async execute(filters?: OrderFilters | string): Promise<EnrichedOrder[]> {
    const orders = await this.orderRepo.getAll(filters);

    const missingUserIds = [
      ...new Set(
        orders
          .filter(
            (order) =>
              order.userId &&
              typeof order.userId === "string" &&
              order.userId.trim() &&
              (!(order as any).userNames || !(order as any).userLastNames)
          )
          .map((order) => order.userId.trim())
      ),
    ];

    const userMap = new Map<string, { names?: string; lastNames?: string }>();
    if (missingUserIds.length > 0) {
      await Promise.all(
        missingUserIds.map(async (uid) => {
          try {
            const user = await this.userRepo.getById(uid);
            if (user) {
              userMap.set(uid, user);
            }
          } catch (error) {
            console.warn(`Error al obtener usuario ${uid} para enriquecer órdenes:`, error);
          }
        })
      );
    }

    return orders.map((order) => {
      const uid =
        order.userId && typeof order.userId === "string"
          ? order.userId.trim()
          : "";
      const user = uid ? userMap.get(uid) : undefined;
      return {
        ...order,
        userNames: (order as any).userNames || user?.names || "",
        userLastNames: (order as any).userLastNames || user?.lastNames || "",
      };
    });
  }

  async executePaginated(query: PaginatedOrdersQuery): Promise<PaginatedOrdersResult> {
    const baseFilters: OrderFilters = {};
    if (query.deliveryType) baseFilters.deliveryType = query.deliveryType;
    if (query.userId) baseFilters.userId = query.userId;
    if (query.withoutTrip !== undefined) baseFilters.withoutTrip = query.withoutTrip;
    if (query.sellerId) baseFilters.sellerId = query.sellerId;

    const allScoped = await this.execute(baseFilters);
    const priority: Record<string, number> = {
      pending: 1,
      approved: 2,
      on_the_way: 3,
      completed: 4,
    };

    const sorted = [...allScoped].sort((a: any, b: any) => {
      const pA = priority[a.status] || 99;
      const pB = priority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const orderCounts: Record<string, number> = {
      Todos: sorted.length,
      pending: 0,
      "Alertas IA": 0,
      approved: 0,
      on_the_way: 0,
      completed: 0,
      rejected: 0,
    };

    let pendingCount = 0;
    let pendingAmount = 0;
    let inRouteCount = 0;
    let approvedCount = 0;
    let aiRiskCount = 0;

    for (const o of sorted as any[]) {
      if (orderCounts[o.status] !== undefined) orderCounts[o.status]++;
      if (o.aiRiskFlag) {
        orderCounts["Alertas IA"]++;
        aiRiskCount++;
      }
      if (o.status === "pending") {
        pendingCount++;
        pendingAmount += (o.items || []).reduce(
          (s: number, it: any) => s + (Number(it.subtotal) || 0),
          0
        );
      }
      if (o.status === "on_the_way") inRouteCount++;
      if (o.status === "approved") approvedCount++;
    }

    const search = (query.search || "").trim().toLowerCase();
    const statusFilter = (query.status || "").trim();

    const filtered = sorted.filter((order: any) => {
      const matchesSearch =
        search === "" ||
        String(order.orderNumber || "").includes(search) ||
        `${order.userNames || ""} ${order.userLastNames || ""}`.toLowerCase().includes(search) ||
        Boolean(order.userPhone && String(order.userPhone).includes(search));

      let matchesStatus = true;
      if (statusFilter === "Alertas IA") {
        matchesStatus = Boolean(order.aiRiskFlag);
      } else if (statusFilter && statusFilter !== "Todos") {
        matchesStatus = order.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });

    const limit = query.limit || 20;
    const page = query.page || 1;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      orders: filtered.slice(start, start + limit),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
      orderCounts,
      kpis: {
        pendingCount,
        pendingAmount,
        inRouteCount,
        approvedCount,
        aiRiskCount,
      },
    };
  }
}
