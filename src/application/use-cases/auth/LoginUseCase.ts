import { AuthService } from "../../../domain/services/AuthService";
import { LoginDto } from "../../dtos/LoginDtos";


export class LoginUseCase {
  constructor(private authService: AuthService) {}

  async execute({ email, password }: LoginDto) {
    const loginResponse = await this.authService.login(email, password);
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
