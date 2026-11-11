import { Request, Response } from "express";
import { GetSupportConfigUseCase } from "../../../application/use-cases/config/GetSupportConfigUseCase";
import { UpdateSupportConfigUseCase } from "../../../application/use-cases/config/UpdateSupportConfigUseCase";
import { SupportConfigFirestoreRepository } from "../../../infrastructure/firestore/SupportConfigFirestoreRepository";

export class SupportConfigController {
  constructor(
    private getSupportConfigUseCase: GetSupportConfigUseCase = new GetSupportConfigUseCase(
      new SupportConfigFirestoreRepository()
    ),
    private updateSupportConfigUseCase: UpdateSupportConfigUseCase = new UpdateSupportConfigUseCase(
      new SupportConfigFirestoreRepository()
    )
  ) {}

  async get(req: Request, res: Response) {
    try {
      const config = await this.getSupportConfigUseCase.execute();
      res.status(200).json({ success: true, data: config });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const adminUid = (req as any).user?.uid || "admin";
      await this.updateSupportConfigUseCase.execute(req.body, adminUid);
      res.status(200).json({
        success: true,
        message: "Configuración de soporte actualizada correctamente",
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
