import { Request, Response } from "express";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { FirebaseAuthService } from "../../../infrastructure/services/FirebaseAuthService";
import { CreateUserUseCase } from "../../../application/use-cases/user/CreateUserUseCase";
import { GetAllUsersUseCase } from "../../../application/use-cases/user/GetAllUsersUseCase";
import { GetUserByIdUseCase } from "../../../application/use-cases/user/GetUserByIdUseCase";
import { UpdateUserStatusUseCase } from "../../../application/use-cases/user/UpdateUserStatusUseCase";
import { UpdateUserUseCase } from "../../../application/use-cases/user/UpdateUserUseCase";
import { User } from "../../../domain/entities/User";

const userRepo = new UserFirestoreRepository();
const authService = new FirebaseAuthService();
const createUserUseCase = new CreateUserUseCase(userRepo, authService);
const getAllUsersUseCase = new GetAllUsersUseCase(userRepo);
const getUserByIdUseCase = new GetUserByIdUseCase(userRepo);
const updateUserStatusUseCase = new UpdateUserStatusUseCase(userRepo);
const updateUserUseCase = new UpdateUserUseCase(userRepo);

export class UserController {
  
  async create(req: Request, res: Response) {
    try {
      const file = req.file || (req.files && Array.isArray(req.files) ? (req.files as any)[0] : undefined);
      const requester = (req as any).user;
      const result = await createUserUseCase.execute(req.body, file, requester);
      res.status(201).json({
        success: true,
        message: "Usuario creado y verificación enviada",
        ...result,
      });
    } catch (error: any) {
      const status = error.message?.includes("Acceso denegado") ? 403 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      await updateUserUseCase.execute(req.body, authUser);
      res.status(200).json({ success: true, message: "Usuario actualizado correctamente" });
    } catch (error: any) {
      const status = error.message?.includes("No tienes permiso") ? 403 : 400;
      res.status(status).json({ success: false, message: error.message });
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

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const authUser = (req as any).user;

      // Prevención de BOLA/IDOR: Solo el propio usuario o un admin pueden consultar este perfil
      if (authUser?.userType !== "admin" && authUser?.uid !== id) {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para ver la información de este usuario",
        });
      }

      const user = await getUserByIdUseCase.execute(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el usuario",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { status, userType, aiRiskFlag } = req.query;
      const filters: any = {};
      if (typeof status === "string" && status !== "undefined" && status.trim()) {
        filters.status = status.trim();
      }
      if (typeof userType === "string" && userType.trim()) {
        filters.userType = userType.trim();
      }
      if (aiRiskFlag !== undefined) {
        filters.aiRiskFlag = String(aiRiskFlag).toLowerCase() === "true";
      }

      const users = await getAllUsersUseCase.execute(filters);
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
