import { BankAccount } from "../entities/BankAccount";

export interface BankAccountRepository {
  getAll(): Promise<BankAccount[]>;
}
