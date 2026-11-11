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
      const summary = await this.getDashboardSummaryUseCase.execute({
        uid: authUser?.uid || "",
        userType: String(authUser?.userType || "").toLowerCase(),
      });

      res.status(200).json({
        success: true,
        ...summary,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el resumen del dashboard",
      });
    }
  }
}
