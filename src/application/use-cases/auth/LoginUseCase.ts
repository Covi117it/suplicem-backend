import { AuthService } from "../../../domain/services/AuthService";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { LoginDto } from "../../dtos/LoginDtos";

export class LoginUseCase {
  constructor(
    private authService: AuthService,
    private userRepo?: UserRepository
  ) {}

  async execute({ email, password }: LoginDto) {
    const loginResponse = await this.authService.login(email, password);

    if (this.userRepo) {
      const user = await this.userRepo.getById(loginResponse.uid);
      if (user?.status === "inactive" || user?.status === "banned") {
        throw new Error("Tu cuenta se encuentra inactiva o suspendida. Comunícate con soporte.");
      }
    }

    let emailVerified = true;
    try {
      const userInfo = await this.authService.getUserByUid(loginResponse.uid);
      emailVerified = userInfo.emailVerified;
    } catch (error: any) {
      console.warn("Advertencia: No se pudo consultar Admin SDK en getUserByUid:", error.message);
    }

    return {
      success: true,
      ...loginResponse,
      emailVerified,
    };
  }
}
