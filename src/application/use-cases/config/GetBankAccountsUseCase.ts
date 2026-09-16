import { BankAccount } from "../../../domain/entities/BankAccount";
import { BankAccountRepository } from "../../../domain/repositories/BankAccountRepository";

export class GetBankAccountsUseCase {
  constructor(private bankAccountRepo: BankAccountRepository) {}

  async execute(): Promise<BankAccount[]> {
    return await this.bankAccountRepo.getAll();
  }
}
