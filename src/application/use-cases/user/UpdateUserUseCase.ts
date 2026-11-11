import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { ApplicationActor } from "../../dtos/UserDtos";
import { NotificationDispatcherService } from "../../services/NotificationDispatcherService";

export class UpdateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private notificationDispatcher?: NotificationDispatcherService
  ) {}

  async execute(
    userToUpdate: Partial<User> & { uid: string },
    requester: ApplicationActor
  ): Promise<void> {
    if (!userToUpdate || !userToUpdate.uid) {
      throw new Error("UID de usuario requerido");
    }

    if (!requester) {
      throw new Error("Usuario no autenticado");
    }

    const isAuthorizedAdmin = requester.userType === "admin" && requester.status === "active";
    const isOwner = requester.uid === userToUpdate.uid;

    if (!isAuthorizedAdmin && !isOwner) {
      throw new Error("No tienes permiso para actualizar este usuario");
    }

    const existingUser = await this.userRepo.getById(userToUpdate.uid);
    if (!existingUser) {
      throw new Error("Usuario no encontrado");
    }

    // Aplicar únicamente campos editables de perfil (Whitelist segura)
    const sanitizedUpdate: Partial<User> = {};
    if (userToUpdate.names !== undefined) sanitizedUpdate.names = userToUpdate.names;
    if (userToUpdate.lastNames !== undefined) sanitizedUpdate.lastNames = userToUpdate.lastNames;
    if (userToUpdate.phone !== undefined) sanitizedUpdate.phone = userToUpdate.phone;
    if (userToUpdate.addresses !== undefined) sanitizedUpdate.addresses = userToUpdate.addresses;
    if (userToUpdate.vehicle !== undefined) sanitizedUpdate.vehicle = userToUpdate.vehicle;
    if (userToUpdate.identificationImage !== undefined) {
      sanitizedUpdate.identificationImage = userToUpdate.identificationImage;
    }
    // Permitir exclusivamente al Administrador asignar o limpiar el vendedor
    if (isAuthorizedAdmin && userToUpdate.sellerId !== undefined) {
      sanitizedUpdate.sellerId = userToUpdate.sellerId ? userToUpdate.sellerId.trim() : null as any;
    }

    await this.userRepo.update(userToUpdate.uid, {
      ...existingUser,
      ...sanitizedUpdate,
      uid: existingUser.uid, // Inmutable
      email: existingUser.email, // Inmutable
      userType: existingUser.userType, // Inmutable vía perfil
      status: existingUser.status, // Inmutable vía perfil
    });

    const newSellerId = sanitizedUpdate.sellerId;
    const sellerChanged = !!newSellerId && newSellerId !== existingUser.sellerId;
    if (this.notificationDispatcher && isAuthorizedAdmin && sellerChanged && existingUser.userType === "client") {
      const clientName =
        existingUser.companyName ||
        `${sanitizedUpdate.names ?? existingUser.names} ${sanitizedUpdate.lastNames ?? existingUser.lastNames}`.trim() ||
        "Cliente";

      this.userRepo
        .getById(requester.uid)
        .then((admin) => {
          const adminName = admin
            ? `${admin.names || ""} ${admin.lastNames || ""}`.trim() || "Administración"
            : "Administración";

          return this.notificationDispatcher!.notifyClientAssigned({
            sellerId: newSellerId,
            adminName,
            clientName,
          });
        })
        .catch((err) =>
          console.warn("[Notification] Error al notificar asignación de cliente:", err?.message || err)
        );
    }
  }
}