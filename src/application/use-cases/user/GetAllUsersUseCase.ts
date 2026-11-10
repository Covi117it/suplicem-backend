import { User } from "../../../domain/entities/User";
import { UserRepository, UserFilters } from "../../../domain/repositories/UserRepository";

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
}