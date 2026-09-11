import { firestore } from "../../config/firebase";
import { User } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";

export class UserFirestoreRepository implements UserRepository {
  async create(user: User): Promise<void> {
    await firestore.collection("users").doc(user.uid).set(user);
  }

  async update(uid: string, data: Partial<User>): Promise<void> {
    await firestore.collection("users").doc(uid).update(data);
  }

  async getById(uid: string): Promise<User | null> {
    try {
      const doc = await firestore.collection("users").doc(uid).get();
      return doc.exists ? (doc.data() as User) : null;
    } catch (error: any) {
      console.warn("Advertencia en Firestore getById:", error.message);
      return null;
    }
  }

  async getAll(): Promise<User[]> {
    const snapshot = await firestore.collection("users").get();
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as User[];
  }
}
