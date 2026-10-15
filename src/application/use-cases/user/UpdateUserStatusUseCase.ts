import { UserRepository } from "../../../domain/repositories/UserRepository";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { UpdateUserStatusDto } from "../../dtos/UserDtos";

export class UpdateUserStatusUseCase {
  private botService = new RegistrationBotService();

  constructor(private userRepo: UserRepository) {}

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
