import { firestore } from "../../config/firebase";
import { Company } from "../../domain/entities/Company";
import { CompanyRepository } from "../../domain/repositories/CompanyRepository";

const COLLECTION = "companies";

export class CompanyFirestoreRepository implements CompanyRepository {
  async create(company: Company): Promise<string> {
    const ref = await firestore.collection(COLLECTION).add(company);
    return ref.id;
  }

  async getById(id: string): Promise<Company | null> {
    const doc = await firestore.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as Company), id: doc.id };
  }

  async getByRnc(rnc: string): Promise<Company | null> {
    const snapshot = await firestore
      .collection(COLLECTION)
      .where("rnc", "==", rnc)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { ...(doc.data() as Company), id: doc.id };
  }

  async update(id: string, data: Partial<Company>): Promise<void> {
    await firestore.collection(COLLECTION).doc(id).update(data);
  }
}
