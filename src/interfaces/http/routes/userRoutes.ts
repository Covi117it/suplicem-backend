import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middlewares/authenticate";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // Limit 15MB
});

export const userRoutes = (router: Router) => {
  const userController = new UserController();

  router.post(
    "/users",
    upload.any(),
    (req, res) => userController.create(req, res)
  );
  router.patch("/users/update", (req, res) =>
    userController.updateUser(req, res)
  );
  router.patch("/users/status", (req, res) =>
    userController.updateStatus(req, res)
  );
  router.get("/users", authenticate, (req, res) =>
    userController.getAll(req, res)
  );
};
