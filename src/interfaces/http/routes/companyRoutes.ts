import { Router } from "express";
import { CompanyController } from "../controllers/CompanyController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import { RegisterCompanySchema } from "../schemas/companySchemas";

export const companyRoutes = (router: Router) => {
  const companyController = new CompanyController();

  router.post(
    "/companies/register",
    authenticate,
    validate(RegisterCompanySchema),
    (req, res) => {
      companyController.register(req, res);
    }
  );

  router.get(
    "/companies/:rnc",
    authenticate,
    requireRole(["admin"]),
    (req, res) => {
      companyController.getByRnc(req, res);
    }
  );
};
