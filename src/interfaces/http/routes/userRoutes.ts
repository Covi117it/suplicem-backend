import { Router } from "express";
import multer from "multer";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";

export const userRoutes = (router: Router) => {
  const userController = new UserController();

  router.post("/users", (req, res) => {
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
  router.get("/users", authenticate, requireRole(["admin"]), (req, res) => {
    userController.getAll(req, res);
  });
};
