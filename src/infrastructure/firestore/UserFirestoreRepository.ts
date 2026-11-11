import { firestore } from "../../config/firebase";
import { User } from "../../domain/entities/User";
import { UserRepository, UserFilters } from "../../domain/repositories/UserRepository";
import { TtlCache } from "../cache/TtlCache";

export class UserFirestoreRepository implements UserRepository {
  private static readonly userCache = new TtlCache<User | null>(15_000);

  async create(user: User): Promise<void> {
    try {
      await firestore.collection("users").doc(user.uid).set(user);
      UserFirestoreRepository.userCache.invalidate(user.uid);
    } catch (error: any) {
      console.warn("Advertencia al guardar usuario en Firestore:", error?.message || error);
    }
  }

  async update(uid: string, data: Partial<User>): Promise<void> {
    try {
      await firestore.collection("users").doc(uid).update(data);
      UserFirestoreRepository.userCache.invalidate(uid);
    } catch (error: any) {
      console.warn("Advertencia al actualizar usuario en Firestore:", error?.message || error);
    }
  }

  async getById(uid: string): Promise<User | null> {
    try {
      return await this.getByIdStrict(uid);
    } catch (error: any) {
      console.warn("Advertencia en Firestore getById:", error.message);
      return null;
    }
  }

  async getByIdStrict(uid: string): Promise<User | null> {
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      return null;
    }

    return UserFirestoreRepository.userCache.getOrLoad(uid, async () => {
      const doc = await firestore.collection("users").doc(uid).get();
      if (!doc.exists) return null;
      const data = { ...(doc.data() as User) };
      if (data.userType === "driver" && !data.driverCode) {
        data.driverCode = `COND-${doc.id.slice(0, 5).toUpperCase()}`;
      } else if (data.userType === "seller" && !data.sellerCode) {
        data.sellerCode = `VEND-${doc.id.slice(0, 5).toUpperCase()}`;
      }
      return { ...data, uid: doc.id };
    });
  }

  async getByPhone(phone: string): Promise<User | null> {
    try {
      const raw = (phone || "").trim();
      if (!raw) return null;

      const digits = raw.replace(/[^0-9]/g, "");
      const candidates = new Set<string>([raw]);

      if (digits.length === 12 && digits.startsWith("1")) {
        candidates.add(`+${digits}`);
        candidates.add(digits.slice(1));
        candidates.add(digits);
      } else if (digits.length === 11 && digits.startsWith("1")) {
        candidates.add(`+${digits}`);
        candidates.add(digits.slice(1));
      } else if (digits.length === 10) {
        candidates.add(`+1${digits}`);
      }

      const candidateList = Array.from(candidates);
      const snapshot = await firestore
        .collection("users")
        .where("phone", "in", candidateList)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { ...(doc.data() as User), uid: doc.id };
      }

      return null;
    } catch (error: any) {
      console.warn("Advertencia al buscar usuario por teléfono:", error?.message);
      return null;
    }
  }

  async getAll(filters?: UserFilters): Promise<User[]> {
    try {
      let query: FirebaseFirestore.Query = firestore.collection("users");

      if (filters?.status) {
        query = query.where("status", "==", filters.status);
      }
      if (filters?.userType) {
        query = query.where("userType", "==", filters.userType);
      }
      if (filters?.sellerId) {
        query = query.where("sellerId", "==", filters.sellerId);
      }
      if (filters?.aiRiskFlag !== undefined) {
        query = query.where("aiRiskFlag", "==", filters.aiRiskFlag);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => {
        const data = doc.data() as User;
        if (data.userType === "driver" && !data.driverCode) {
          data.driverCode = `COND-${doc.id.slice(0, 5).toUpperCase()}`;
        } else if (data.userType === "seller" && !data.sellerCode) {
          data.sellerCode = `VEND-${doc.id.slice(0, 5).toUpperCase()}`;
        }
        return {
          ...data,
          uid: doc.id,
        };
      });
    } catch (error: any) {
      console.warn("Advertencia al obtener usuarios en Firestore:", error?.message || error);
      return [];
    }
  }
}
