import { firestore } from "../../config/firebase";
import { User } from "../../domain/entities/User";
import { UserRepository, UserFilters } from "../../domain/repositories/UserRepository";

export class UserFirestoreRepository implements UserRepository {
  async create(user: User): Promise<void> {
    try {
      await firestore.collection("users").doc(user.uid).set(user);
    } catch (error: any) {
      console.warn("Advertencia al guardar usuario en Firestore:", error?.message || error);
    }
  }

  async update(uid: string, data: Partial<User>): Promise<void> {
    try {
      await firestore.collection("users").doc(uid).update(data);
    } catch (error: any) {
      console.warn("Advertencia al actualizar usuario en Firestore:", error?.message || error);
    }
  }

  async getById(uid: string): Promise<User | null> {
    try {
      if (!uid || typeof uid !== "string" || !uid.trim()) {
        return null;
      }
      const doc = await firestore.collection("users").doc(uid).get();
      return doc.exists ? (doc.data() as User) : null;
    } catch (error: any) {
      console.warn("Advertencia en Firestore getById:", error.message);
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
      if (filters?.aiRiskFlag !== undefined) {
        query = query.where("aiRiskFlag", "==", filters.aiRiskFlag);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];
    } catch (error: any) {
      console.warn("Advertencia al obtener usuarios en Firestore:", error?.message || error);
      return [];
    }
  }
}
