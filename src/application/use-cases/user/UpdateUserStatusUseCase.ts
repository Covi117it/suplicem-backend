import { UserRepository } from "../../../domain/repositories/UserRepository";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { UpdateUserStatusDto } from "../../dtos/UserDtos";

export class UpdateUserStatusUseCase {
  private botService = new RegistrationBotService();

  constructor(private userRepo: UserRepository) {}

  async execute({ uid, status }: UpdateUserStatusDto): Promise<void> {
    const user = await this.userRepo.getById(uid);

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const previousStatus = user.status;
    user.status = status;
    await this.userRepo.update(uid, user);

    // Si el administrador aprueba la cuenta (estado cambia a 'active'), enviar correo con el bot
    if (status === "active" && previousStatus !== "active") {
      await this.botService.sendAccountApprovedEmailBot(
        user.email,
        user.names || "Usuario",
        user.lastNames || ""
      );
    }
  }
}
