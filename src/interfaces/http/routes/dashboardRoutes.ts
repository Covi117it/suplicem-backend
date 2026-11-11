import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validateQuery } from "../middlewares/validate";
import { DashboardSummaryQuerySchema } from "../schemas/dashboardSchemas";

export const dashboardRoutes = (router: Router) => {
  const dashboardController = new DashboardController();

  router.get(
    "/dashboard/summary",
    authenticate,
    requireRole(["admin", "seller"]),
    validateQuery(DashboardSummaryQuerySchema),
    async (req, res) => {
      await dashboardController.getSummary(req, res);
    }
  );
};
