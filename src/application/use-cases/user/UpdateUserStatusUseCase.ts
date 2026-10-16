import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { UpdateUserStatusDto } from "../../dtos/UserDtos";

export class UpdateUserStatusUseCase {
  private botService = new RegistrationBotService();

  constructor(
    private userRepo: UserRepository,
    private authService?: AuthService
  ) {}

  async execute({ uid, status }: UpdateUserStatusDto, requesterUid?: string): Promise<void> {
    if (requesterUid && requesterUid === uid && (status === "inactive" || status === "banned")) {
      throw new Error("No puedes desactivar o suspender tu propia cuenta de administrador");
    }

    const user = await this.userRepo.getById(uid);

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const previousStatus = user.status;
    user.status = status;
    await this.userRepo.update(uid, user);

    // Sincronizar estado en Firebase Auth y revocar sesiones activas
    if (status === "inactive" || status === "banned") {
      await this.authService?.setUserDisabled?.(uid, true);
      await this.authService?.revokeRefreshTokens?.(uid);
    } else if (status === "active") {
      await this.authService?.setUserDisabled?.(uid, false);
    }

    // Si el administrador aprueba una cuenta nueva por primera vez (estado cambia de 'pending' a 'active'), enviar correo con el bot
    if (status === "active" && previousStatus === "pending") {
      await this.botService.sendAccountApprovedEmailBot(
        user.email,
        user.names || "Usuario",
        user.lastNames || ""
      );
    }
  }
}
