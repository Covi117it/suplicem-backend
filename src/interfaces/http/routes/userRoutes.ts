import { Router } from "express";
import multer from "multer";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";

const upload = multer({ storage: multer.memoryStorage() });

export const userRoutes = (router: Router) => {
  const userController = new UserController();

  router.post("/users", upload.any(), (req, res) => {
    userController.create(req, res);
  });
  router.patch("/users/update", authenticate, (req, res) => {
    userController.updateUser(req, res);
  });
  router.patch(
    "/users/status",
    authenticate,
    requireRole(["admin"]),
    (req, res) => {
      userController.updateStatus(req, res);
    }
  );
  router.get("/users/:id", authenticate, (req, res) => {
    userController.getById(req, res);
  });
  router.get("/users", authenticate, requireRole(["admin"]), (req, res) => {
    userController.getAll(req, res);
  });
};
