import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class GetUserByIdUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(userId: string): Promise<User | null> {
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("ID de usuario requerido");
    }

    return await this.userRepo.getById(userId.trim());
  }
}
