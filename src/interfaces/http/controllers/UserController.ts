import { Request, Response } from "express";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { FirebaseAuthService } from "../../../infrastructure/services/FirebaseAuthService";
import { CreateUserUseCase } from "../../../application/use-cases/user/CreateUserUseCase";
import { GetAllUsersUseCase } from "../../../application/use-cases/user/GetAllUsersUseCase";
import { UpdateUserStatusUseCase } from "../../../application/use-cases/user/UpdateUserStatusUseCase";
import { UpdateUserUseCase } from "../../../application/use-cases/user/UpdateUserUseCase";
import { User } from "../../../domain/entities/User";

const userRepo = new UserFirestoreRepository();
const authService = new FirebaseAuthService();
const createUserUseCase = new CreateUserUseCase(userRepo, authService);
const getAllUsersUseCase = new GetAllUsersUseCase(userRepo);
const updateUserStatusUseCase = new UpdateUserStatusUseCase(userRepo);
const updateUserUseCase = new UpdateUserUseCase(userRepo);

export class UserController {
  async create(req: Request, res: Response) {
    try {
      await createUserUseCase.execute(req.body);
      res
        .status(201)
        .json({ success: true, message: "Usuario creado y verificación enviada" });
    } catch (error: any) {
      console.error("Error en UserController.create:", error);
      let errorMsg = error.message || "Error al crear el usuario";
      if (errorMsg.includes("The email address is already in use")) {
        errorMsg = "El correo electrónico ya se encuentra registrado por otro usuario.";
      } else if (errorMsg.includes("Password must be at least 6 characters")) {
        errorMsg = "La contraseña debe tener al menos 6 caracteres.";
      }
      res.status(400).json({ success: false, message: errorMsg, error: errorMsg });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const user: User = req.body;
      await updateUserUseCase.execute(user);
      res.status(200).json({ message: "Usuario actualizado correctamente" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { uid, status } = req.body;
      await updateUserStatusUseCase.execute({ uid, status });
      res.status(200).json({ message: "Estado actualizado correctamente" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const users = await getAllUsersUseCase.execute();
      res.status(200).json({
        success: true,
        users,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los usuarios",
      });
    }
  }
}
