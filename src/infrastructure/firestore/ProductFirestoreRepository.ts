import { firestore } from "../../config/firebase";
import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";

export class ProductFirestoreRepository implements ProductRepository {
  async create(product: Product): Promise<string> {
    const docRef = await firestore.collection("products").add(product);
    return docRef.id;
  }

  async getAll(): Promise<Product[]> {
    try {
      const snapshot = await firestore.collection("products").get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
    } catch (error: any) {
      console.warn("Advertencia en Firestore Product.getAll:", error.message);
      return [];
    }
  }

  async search(query?: string): Promise<Product[]> {
    try {
      let ref: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        firestore.collection("products");

      if (query) {
        ref = ref
          .where("name", ">=", query.toLowerCase())
          .where("name", "<=", query.toLowerCase() + "\uf8ff");
      }

      const snapshot = await ref.get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
    } catch (error: any) {
      console.warn("Advertencia en Firestore Product.search:", error.message);
      return [];
    }
  }

  async update(id: string, productData: Partial<Product>): Promise<void> {
    await firestore.collection("products").doc(id).update(productData);
  }

  async delete(id: string): Promise<void> {
    await firestore.collection("products").doc(id).delete();
  }
}
