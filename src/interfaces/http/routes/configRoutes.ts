import { Router } from "express";
import { ConfigController } from "../controllers/ConfigController";
import { authenticate } from "../middlewares/authenticate";

export const configRoutes = (router: Router) => {
  const configController = new ConfigController();

  router.get("/config/bank-accounts", authenticate, async (req, res) => {
    await configController.getBankAccounts(req, res);
  });

  router.get("/bank-accounts", authenticate, async (req, res) => {
    await configController.getBankAccounts(req, res);
  });
};
