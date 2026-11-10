import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class GetUserByIdUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(userId: string): Promise<User | null> {
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("ID de usuario requerido");
    }

    const user = await this.userRepo.getById(userId.trim());
    if (user && user.sellerId) {
      try {
        const seller = await this.userRepo.getById(user.sellerId);
        if (seller) {
          user.sellerName = `${seller.names} ${seller.lastNames || ""}`.trim();
          user.sellerCode = seller.sellerCode;
          user.sellerPhone = seller.phone;
        }
      } catch (e) {
        console.warn("Error al enriquecer vendedor asignado:", e);
      }
    }

    return user;
  }
}
