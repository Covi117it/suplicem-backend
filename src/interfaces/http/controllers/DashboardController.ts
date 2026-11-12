import { Request, Response } from "express";
import { OrderFirestoreRepository } from "../../../infrastructure/firestore/OrderFirestoreRepository";
import { TripFirestoreRepository } from "../../../infrastructure/firestore/TripFirestoreRepository";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { GetDashboardSummaryUseCase } from "../../../application/use-cases/dashboard/GetDashboardSummaryUseCase";

const defaultUseCase = new GetDashboardSummaryUseCase(
  new OrderFirestoreRepository(),
  new TripFirestoreRepository(),
  new UserFirestoreRepository()
);

export class DashboardController {
  constructor(
    private getDashboardSummaryUseCase: GetDashboardSummaryUseCase = defaultUseCase
  ) {}

  async getSummary(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      const userType = String(authUser?.userType || "").toLowerCase();
      const uid = authUser?.uid || "";

      if (req.query.force === "true") {
        const cacheKey = userType === "seller" ? `seller:${uid}` : "admin";
        GetDashboardSummaryUseCase.invalidateCache(cacheKey);
      }

      const summary = await this.getDashboardSummaryUseCase.execute({
        uid,
        userType,
      });

      res.status(200).json({
        success: true,
        ...summary,
      });
    } catch (error: any) {
      console.error("[DashboardController.getSummary] Error:", error?.message || error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el resumen del dashboard",
      });
    }
  }
}
