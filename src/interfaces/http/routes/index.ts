import { Router } from "express";
import { userRoutes } from "./userRoutes";
import { authRoutes } from "./authRoutes";
import { productRoutes } from "./productRoutes";
import { cartRoutes } from "./cartRoutes";
import { orderRoutes } from "./orderRoutes";
import { tripRoutes } from "./tripRoutes";
import { locationRoutes } from "./locationRoutes";
import { configRoutes } from "./configRoutes";

export const registerRoutes = (): Router => {
  const router = Router();

  authRoutes(router);
  userRoutes(router);
  productRoutes(router);
  cartRoutes(router);
  orderRoutes(router);
  tripRoutes(router);
  locationRoutes(router);
  configRoutes(router);

  return router;
};
