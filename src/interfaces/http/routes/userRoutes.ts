import { Router } from "express";
import multer from "multer";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validate, validateParams } from "../middlewares/validate";
import { identityLimiter } from "../middlewares/rateLimiter";
import { CedulaParamSchema } from "../schemas/identitySchemas";
import { normalizeUserData } from "../middlewares/normalizeUserData";
import { authenticateOptional } from "../middlewares/authenticateOptional";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
} from "../schemas/userSchemas";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB límite estricto
});

export const userRoutes = (router: Router) => {
  const userController = new UserController();

  router.post(
    "/users",
    upload.any(),
    normalizeUserData,
    authenticateOptional,
    validate(CreateUserSchema),
    (req, res) => {
      userController.create(req, res);
    }
  );

  router.patch(
    "/users/update",
    authenticate,
    validate(UpdateUserSchema),
    (req, res) => {
      userController.updateUser(req, res);
    }
  );

  router.patch(
    "/users/status",
    authenticate,
    requireRole(["admin"]),
    validate(UpdateUserStatusSchema),
    (req, res) => {
      userController.updateStatus(req, res);
    }
  );

  router.get(
    "/identity/cedula/:cedula",
    identityLimiter,
    validateParams(CedulaParamSchema),
    (req, res) => {
      userController.verifyCedula(req, res);
    }
  );

  router.get("/users/:id", authenticate, (req, res) => {
    userController.getById(req, res);
  });

  router.get("/users", authenticate, requireRole(["admin"]), (req, res) => {
    userController.getAll(req, res);
  });
};
