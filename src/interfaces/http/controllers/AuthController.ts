import { Request, Response } from "express";
import { FirebaseAuthService } from "../../../infrastructure/services/FirebaseAuthService";
import { LoginUseCase } from "../../../application/use-cases/auth/LoginUseCase";
import { RefreshTokenUseCase } from "../../../application/use-cases/auth/RefreshTokenUseCase";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { GetCurrentUserUseCase } from "../../../application/use-cases/user/GetCurrentUserUseCase";
import { RecoverPasswordUseCase } from "../../../application/use-cases/auth/RecoverPasswordUseCase";
import { ResendVerificationUseCase } from "../../../application/use-cases/auth/ResendVerificationUseCase";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";

const authService = new FirebaseAuthService();
const userRepo = new UserFirestoreRepository();
const botService = new RegistrationBotService();

export class AuthController {
  constructor(
    private loginUseCase = new LoginUseCase(authService),
    private refreshTokenUseCase = new RefreshTokenUseCase(authService),
    private recoverPasswordUseCase = new RecoverPasswordUseCase(authService),
    private getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo),
    private resendVerificationUseCase = new ResendVerificationUseCase(authService, botService)
  ) {}

  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    try {
      const result = await this.loginUseCase.execute({ email, password });
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error en login:", error?.response?.data || error.message);
      const rawMessage = error.response?.data?.error?.message;
      let message = "Error al iniciar sesión";
      if (rawMessage === "INVALID_LOGIN_CREDENTIALS" || rawMessage === "INVALID_PASSWORD" || rawMessage === "EMAIL_NOT_FOUND") {
        message = "Correo o contraseña incorrectos";
      } else if (rawMessage === "USER_DISABLED") {
        message = "La cuenta de usuario ha sido deshabilitada";
      } else if (rawMessage === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        message = "Acceso bloqueado temporalmente por demasiados intentos fallidos";
      } else if (rawMessage) {
        message = rawMessage;
      }
      res.status(400).json({
        success: false,
        message,
      });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const result = await this.refreshTokenUseCase.execute(refreshToken);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Error al refrescar el token",
      });
    }
  }

  async recoverPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      await this.recoverPasswordUseCase.execute(email);
      res.status(200).json({
        success: true,
        message: "Se ha enviado un correo con las instrucciones para restablecer la contraseña.",
      });
    } catch (error: any) {
      console.error("Error al enviar correo de recuperación:", error);
      res.status(500).json({
        success: false,
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "No se pudo enviar el correo de recuperación",
      });
    }
  }

  async getCurrentUser(req: Request, res: Response) {
    try {
      const uid = req.user?.uid;
      if (!uid) throw new Error("Usuario no autenticado");

      const user = await this.getCurrentUserUseCase.execute(uid);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      res.status(error.message === "Usuario no encontrado" ? 404 : 500).json({
        success: false,
        message: error.message || "Error al obtener el usuario",
      });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const { email, idToken } = req.body;
      const result = await this.resendVerificationUseCase.execute({ email, idToken });
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error en resendVerification:", error?.message || error);
      const isNotFound = error.message?.includes("No existe");
      const isAlreadyVerified = error.message?.includes("ya se encuentra verificada");
      res.status(isNotFound ? 404 : isAlreadyVerified ? 400 : 500).json({
        success: false,
        message: error.message || "Error al reenviar correo de verificación",
      });
    }
  }
}
