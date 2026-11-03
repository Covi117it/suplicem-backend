import { firestore } from "../../config/firebase";
import { IdentityRecord } from "../../domain/entities/IdentityRecord";
import { IdentityCacheRepository } from "../../domain/repositories/IdentityCacheRepository";

const COLLECTION = "identityCache";

export class IdentityCacheFirestoreRepository implements IdentityCacheRepository {
  async get(cedula: string): Promise<IdentityRecord | null> {
    const doc = await firestore.collection(COLLECTION).doc(cedula).get();
    if (!doc.exists) return null;
    return doc.data() as IdentityRecord;
  }

  async save(record: IdentityRecord): Promise<void> {
    await firestore.collection(COLLECTION).doc(record.cedula).set(record);
  }
}
