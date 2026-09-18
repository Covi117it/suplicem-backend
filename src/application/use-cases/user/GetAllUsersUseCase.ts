import { User } from "../../../domain/entities/User";
import { UserRepository, UserFilters } from "../../../domain/repositories/UserRepository";

export class GetAllUsersUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(filters?: UserFilters): Promise<User[]> {
    return await this.userRepo.getAll(filters);
  }
}