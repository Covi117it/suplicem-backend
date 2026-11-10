import { firestore } from "../../config/firebase";
import { RncRecord } from "../../domain/entities/RncRecord";
import { RncCacheRepository } from "../../domain/repositories/RncCacheRepository";

const COLLECTION = "rncCache";

export class RncCacheFirestoreRepository implements RncCacheRepository {
  async get(rnc: string): Promise<RncRecord | null> {
    const doc = await firestore.collection(COLLECTION).doc(rnc).get();
    if (!doc.exists) return null;
    return doc.data() as RncRecord;
  }

  async save(record: RncRecord): Promise<void> {
    await firestore.collection(COLLECTION).doc(record.rnc).set(record);
  }
}
