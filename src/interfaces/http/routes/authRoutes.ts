import { validate } from "../middlewares/validate";
import {
  LoginSchema,
  RefreshTokenSchema,
  RecoverPasswordSchema,
  ResendVerificationSchema,
} from "../schemas/authSchemas";
import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middlewares/authenticate";

export const authRoutes = (router: Router) => {
  const authController = new AuthController();

  router.post("/auth/login", validate(LoginSchema), (req, res) => authController.login(req, res));
  router.post("/auth/refresh-token", validate(RefreshTokenSchema), (req, res) =>
    authController.refreshToken(req, res)
  );
  router.get("/auth/me", authenticate, (req, res) =>
    authController.getCurrentUser(req, res)
  );
  router.post("/auth/recover-password", validate(RecoverPasswordSchema), (req, res) =>
    authController.recoverPassword(req, res)
  );
  router.post("/auth/resend-verification", validate(ResendVerificationSchema), (req, res) =>
    authController.resendVerification(req, res)
  );
};
