import { validate } from "../middlewares/validate";
import {
  LoginSchema,
  RefreshTokenSchema,
  RecoverPasswordSchema,
  ResendVerificationSchema,
  RequestOtpSchema,
  VerifyOtpSchema,
  RegisterWithPhoneSchema,
} from "../schemas/authSchemas";
import { Router } from "express";
import multer from "multer";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middlewares/authenticate";
import { normalizeUserData } from "../middlewares/normalizeUserData";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB límite estricto
});
import {
  authLimiter,
  emailLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} from "../middlewares/rateLimiter";

export const authRoutes = (router: Router) => {
  const authController = new AuthController();

  router.post("/auth/login", authLimiter, validate(LoginSchema), (req, res) =>
    authController.login(req, res)
  );
  router.post(
    "/auth/otp/request",
    otpRequestLimiter,
    validate(RequestOtpSchema),
    (req, res) => authController.requestOtp(req, res)
  );
  router.post(
    "/auth/otp/verify",
    otpVerifyLimiter,
    validate(VerifyOtpSchema),
    (req, res) => authController.verifyOtp(req, res)
  );
  router.post(
    "/auth/register-phone",
    otpVerifyLimiter,
    upload.any(),
    normalizeUserData,
    validate(RegisterWithPhoneSchema),
    (req, res) => authController.registerWithPhone(req, res)
  );
  router.post("/auth/refresh-token", validate(RefreshTokenSchema), (req, res) =>
    authController.refreshToken(req, res)
  );
  router.get("/auth/me", authenticate, (req, res) =>
    authController.getCurrentUser(req, res)
  );
  router.post(
    "/auth/recover-password",
    emailLimiter,
    validate(RecoverPasswordSchema),
    (req, res) => authController.recoverPassword(req, res)
  );
  router.post(
    "/auth/resend-verification",
    emailLimiter,
    validate(ResendVerificationSchema),
    (req, res) => authController.resendVerification(req, res)
  );
};
