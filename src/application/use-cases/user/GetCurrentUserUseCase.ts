import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class GetCurrentUserUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(uid: string): Promise<User> {
    const user = await this.userRepo.getById(uid);

    if (!user) {
      return {
        uid,
        email: "",
        names: "Usuario",
        lastNames: "",
        phone: "",
        identificationType: "Cedula",
        identification: "",
        userType: "client",
        addresses: [],
        status: "active"
      } as unknown as User;
    }

    return user;
  }
}
