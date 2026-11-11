import { User } from "../../../domain/entities/User";
import { UserRepository, UserFilters } from "../../../domain/repositories/UserRepository";

export interface PaginatedUsersQuery {
  baseFilters?: UserFilters;
  roleFilter?: string;
  statusFilter?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsersResult {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  roleCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

export class GetAllUsersUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(filters?: UserFilters): Promise<User[]> {
    const users = await this.userRepo.getAll(filters);

    // Mapeo en memoria de vendedores presentes en la lista
    const sellerMap = new Map<string, { name: string; code?: string }>();
    users.forEach((u) => {
      if (u.userType === "seller") {
        const code = u.sellerCode || (u.uid ? `VEND-${u.uid.slice(0, 5).toUpperCase()}` : "VEND-XXXX");
        sellerMap.set(u.uid, {
          name: `${u.names} ${u.lastNames || ""}`.trim(),
          code,
        });
      }
    });

    // Si algún cliente tiene un vendedor no incluido en el lote actual (ej: filtro userType=client)
    const missingSellerIds = [
      ...new Set(
        users
          .filter((u) => u.userType === "client" && u.sellerId && !sellerMap.has(u.sellerId))
          .map((u) => u.sellerId as string)
      ),
    ];

    if (missingSellerIds.length > 0) {
      await Promise.all(
        missingSellerIds.map(async (sId) => {
          try {
            const seller = await this.userRepo.getById(sId);
            if (seller) {
              const code = seller.sellerCode || `VEND-${seller.uid.slice(0, 5).toUpperCase()}`;
              sellerMap.set(sId, {
                name: `${seller.names} ${seller.lastNames || ""}`.trim(),
                code,
              });
            }
          } catch (e) {
            console.warn(`Error al cargar vendedor ${sId}:`, e);
          }
        })
      );
    }

    return users.map((u) => {
      if (u.userType === "client" && u.sellerId) {
        const seller = sellerMap.get(u.sellerId);
        if (seller) {
          u.sellerName = seller.name;
          u.sellerCode = seller.code;
        }
      }
      return u;
    });
  }

  async executePaginated(query: PaginatedUsersQuery): Promise<PaginatedUsersResult> {
    const allUsers = await this.execute(query.baseFilters);
    const roleFilter = (query.roleFilter || "all").toLowerCase();
    const statusFilter = (query.statusFilter || "all").toLowerCase();
    const search = (query.search || "").trim().toLowerCase();

    const relevantForRoles =
      statusFilter === "all"
        ? allUsers
        : allUsers.filter((u) => {
            const st = u.status?.toLowerCase();
            if (statusFilter === "active") return st === "active";
            if (statusFilter === "inactive") return st === "inactive" || st === "pending";
            return st === statusFilter;
          });

    const roleCounts: Record<string, number> = {
      all: relevantForRoles.length,
      client: 0,
      seller: 0,
      driver: 0,
      admin: 0,
    };
    relevantForRoles.forEach((u) => {
      const role = u.userType?.toLowerCase();
      if (role && roleCounts[role] !== undefined) {
        roleCounts[role]++;
      }
    });

    const relevantForStatus =
      roleFilter === "all"
        ? allUsers
        : allUsers.filter((u) => u.userType?.toLowerCase() === roleFilter);

    const statusCounts: Record<string, number> = {
      all: relevantForStatus.length,
      active: 0,
      inactive: 0,
    };
    relevantForStatus.forEach((u) => {
      const st = u.status?.toLowerCase();
      if (st === "active") statusCounts.active++;
      else if (st === "inactive" || st === "pending") statusCounts.inactive++;
    });

    const filtered = allUsers.filter((user) => {
      if (roleFilter !== "all" && user.userType?.toLowerCase() !== roleFilter) {
        return false;
      }

      const st = user.status?.toLowerCase();
      if (statusFilter === "active" && st !== "active") {
        return false;
      }
      if (statusFilter === "inactive" && st !== "inactive" && st !== "pending") {
        return false;
      }
      if (
        statusFilter !== "all" &&
        statusFilter !== "active" &&
        statusFilter !== "inactive" &&
        st !== statusFilter
      ) {
        return false;
      }

      if (!search) return true;
      const fullName = `${user.names || ""} ${user.lastNames || ""}`.toLowerCase();
      return (
        fullName.includes(search) ||
        (user.email || "").toLowerCase().includes(search) ||
        (user.phone || "").toLowerCase().includes(search) ||
        (user.identification || "").toLowerCase().includes(search) ||
        (user.driverCode || "").toLowerCase().includes(search) ||
        (user.sellerCode || "").toLowerCase().includes(search) ||
        (user.sellerName || "").toLowerCase().includes(search) ||
        (user.vehicle?.plateNumber || "").toLowerCase().includes(search)
      );
    });

    const limit = query.limit || 20;
    const page = query.page || 1;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      users: filtered.slice(start, start + limit),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
      roleCounts,
      statusCounts,
    };
  }
}