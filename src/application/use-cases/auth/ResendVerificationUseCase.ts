import { FirebaseAuthService } from "../../../infrastructure/services/FirebaseAuthService";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";

export interface ResendVerificationDto {
  email?: string;
  idToken?: string;
}

export class ResendVerificationUseCase {
  constructor(
    private authService: FirebaseAuthService,
    private botService: RegistrationBotService
  ) {}

  async execute({ email, idToken }: ResendVerificationDto): Promise<{ success: boolean; message: string }> {
    if (idToken) {
      await this.authService.sendVerificationEmail(idToken);
      return {
        success: true,
        message: "Correo de verificación reenviado exitosamente",
      };
    }

    if (!email) {
      throw new Error("El correo electrónico es requerido");
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user;
    try {
      user = await this.authService.getUserByEmail(normalizedEmail);
    } catch (err: any) {
      throw new Error("No existe ninguna cuenta registrada con este correo electrónico");
    }

    if (user.emailVerified) {
      throw new Error("Esta cuenta ya se encuentra verificada. Puedes iniciar sesión normalmente.");
    }

    const link = await this.authService.generateEmailVerificationLink(normalizedEmail);
    await this.botService.sendVerificationEmailBot(normalizedEmail, link);

    return {
      success: true,
      message: "Correo de verificación reenviado exitosamente",
    };
  }
}
