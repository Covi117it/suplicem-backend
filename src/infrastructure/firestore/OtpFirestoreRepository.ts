import { firestore } from "../../config/firebase";
import { OtpChallenge } from "../../domain/entities/OtpChallenge";
import { OtpRepository } from "../../domain/repositories/OtpRepository";

const COLLECTION = "otpChallenges";

export class OtpFirestoreRepository implements OtpRepository {
  async save(challenge: OtpChallenge): Promise<void> {
    await firestore.collection(COLLECTION).doc(challenge.phone).set(challenge);
  }

  async getByPhone(phone: string): Promise<OtpChallenge | null> {
    const doc = await firestore.collection(COLLECTION).doc(phone).get();
    if (!doc.exists) return null;
    return doc.data() as OtpChallenge;
  }

  async delete(phone: string): Promise<void> {
    try {
      await firestore.collection(COLLECTION).doc(phone).delete();
    } catch (error: any) {
      console.warn("Advertencia al eliminar OTP:", error?.message);
    }
  }
}
