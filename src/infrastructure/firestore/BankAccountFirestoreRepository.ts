import { firestore } from "../../config/firebase";
import { BankAccount } from "../../domain/entities/BankAccount";
import { BankAccountRepository } from "../../domain/repositories/BankAccountRepository";

export class BankAccountFirestoreRepository implements BankAccountRepository {
  async getAll(): Promise<BankAccount[]> {
    const snapshot = await firestore.collection("bank_accounts").get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BankAccount[];
  }
}
