import { firestore } from "../../config/firebase";
import { BankAccount } from "../../domain/entities/BankAccount";
import { BankAccountRepository } from "../../domain/repositories/BankAccountRepository";

export class BankAccountFirestoreRepository implements BankAccountRepository {
  async getAll(): Promise<BankAccount[]> {
    const snapshot = await firestore.collection("bank_accounts").get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        bankName: data.bankName || data.bank || "Banco",
        accountNumber: data.accountNumber || "",
        accountType: data.accountType || "",
        rnc: data.rnc || "",
        currency: data.currency || "DOP (Pesos Dominicanos)",
        holder: data.holder || data.accountHolder || "SUPLICEM S.R.L.",
        ...data,
      };
    }) as BankAccount[];
  }
}
