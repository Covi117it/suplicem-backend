import { Request, Response } from "express";
import { BankAccountFirestoreRepository } from "../../../infrastructure/firestore/BankAccountFirestoreRepository";
import { GetBankAccountsUseCase } from "../../../application/use-cases/config/GetBankAccountsUseCase";

const bankAccountRepo = new BankAccountFirestoreRepository();
const getBankAccountsUseCase = new GetBankAccountsUseCase(bankAccountRepo);

export class ConfigController {
  async getBankAccounts(_req: Request, res: Response) {
    try {
      const bankAccounts = await getBankAccountsUseCase.execute();

      res.status(200).json({
        success: true,
        bankAccounts,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener las cuentas bancarias",
      });
    }
  }
}
