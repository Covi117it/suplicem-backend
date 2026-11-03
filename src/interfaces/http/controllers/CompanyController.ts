import { Request, Response } from "express";
import { CompanyFirestoreRepository } from "../../../infrastructure/firestore/CompanyFirestoreRepository";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { RegisterCompanyUseCase } from "../../../application/use-cases/company/RegisterCompanyUseCase";

const companyRepo = new CompanyFirestoreRepository();
const userRepo = new UserFirestoreRepository();
const registerCompanyUseCase = new RegisterCompanyUseCase(companyRepo, userRepo);

export class CompanyController {
  async register(req: Request, res: Response) {
    try {
      const requester = (req as any).user;
      if (!requester?.uid) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      const company = await registerCompanyUseCase.execute(req.body, requester);
      res.status(201).json({
        success: true,
        message: "Empresa registrada. Tu cuenta quedó pendiente de aprobación.",
        company,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || "No se pudo registrar la empresa",
      });
    }
  }

  async getByRnc(req: Request, res: Response) {
    try {
      const { rnc } = req.params;
      const company = await companyRepo.getByRnc(rnc);
      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Empresa no encontrada",
        });
      }
      res.status(200).json({ success: true, company });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al consultar la empresa",
      });
    }
  }
}
