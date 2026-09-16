import { firestore } from "../../config/firebase";
import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";

const DEFAULT_PRODUCTS = [
  {
    name: "Funda de Cemento Gris Titan (42.5kg)",
    unit: "fundas",
    price: 510,
    imageUrl: "https://enfoco.com.do/test/suplicem/cemento.jpg",
    createdAt: new Date().toISOString(),
  },
  {
    name: "Funda de Cemento Cibao (42.5kg)",
    unit: "fundas",
    price: 500,
    imageUrl: "https://enfoco.com.do/test/suplicem/cemento.jpg",
    createdAt: new Date().toISOString(),
  },
  {
    name: "Varilla de Construcción 3/8\" (Quintal)",
    unit: "quintal",
    price: 3200,
    imageUrl: "https://enfoco.com.do/test/suplicem/cemento.jpg",
    createdAt: new Date().toISOString(),
  },
  {
    name: "Arena Lavada para Construcción (Metro Cúbico)",
    unit: "metro_cubico",
    price: 1100,
    imageUrl: "https://enfoco.com.do/test/suplicem/cemento.jpg",
    createdAt: new Date().toISOString(),
  },
  {
    name: "Gravilla de Construcción 3/4\" (Metro Cúbico)",
    unit: "metro_cubico",
    price: 1300,
    imageUrl: "https://enfoco.com.do/test/suplicem/cemento.jpg",
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_PRODUCTS: Product[] = DEFAULT_PRODUCTS.map((p, index) => ({
  id: `prod-${index + 1}`,
  ...p,
}));

export class ProductFirestoreRepository implements ProductRepository {
  private inMemoryProducts: Product[] = [...INITIAL_PRODUCTS];

  async create(product: Product): Promise<string> {
    try {
      const docRef = await firestore.collection("products").add(product);
      const newProduct = { ...product, id: docRef.id };
      this.inMemoryProducts.push(newProduct);
      return docRef.id;
    } catch (error: any) {
      console.warn("Advertencia al crear producto en Firestore:", error?.message || error);
      const fakeId = `prod-${Date.now()}`;
      this.inMemoryProducts.push({ ...product, id: fakeId });
      return fakeId;
    }
  }

  async getAll(): Promise<Product[]> {
    try {
      const snapshot = await firestore.collection("products").get();

      if (snapshot.empty) {
        console.log("⚠️ Colección 'products' vacía en Firestore. Usando productos por defecto...");
        const seededProducts: Product[] = [];
        for (const defaultProd of DEFAULT_PRODUCTS) {
          try {
            const docRef = await firestore.collection("products").add(defaultProd);
            seededProducts.push({ id: docRef.id, ...defaultProd });
          } catch (err) {
            // Ignorar errores de escritura individuales
          }
        }
        if (seededProducts.length > 0) {
          this.inMemoryProducts = seededProducts;
        }
        return this.inMemoryProducts;
      }

      const productsFromDb = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.nombre || data.title || "",
          unit: data.unit || data.unidad || "fundas",
          price: Number(data.price || data.precio || 0),
          imageUrl: data.imageUrl || data.image || data.foto || "https://enfoco.com.do/test/suplicem/cemento.jpg",
          createdAt: data.createdAt || new Date().toISOString(),
          ...data,
        };
      }) as Product[];

      this.inMemoryProducts = productsFromDb;
      return productsFromDb;
    } catch (error: any) {
      console.warn("Advertencia en Firestore Product.getAll:", error.message, "- retornando productos locales");
      return this.inMemoryProducts;
    }
  }

  async search(query?: string): Promise<Product[]> {
    try {
      const allProducts = await this.getAll();
      if (!query || !query.trim()) {
        return allProducts;
      }

      const q = query.trim().toLowerCase();
      return allProducts.filter((product) => {
        const name = (product.name || (product as any).nombre || "").toLowerCase();
        const unit = (product.unit || (product as any).unidad || "").toLowerCase();
        return name.includes(q) || unit.includes(q);
      });
    } catch (error: any) {
      console.warn("Advertencia en Firestore Product.search:", error.message, "- filtrando sobre productos locales");
      const q = (query || "").trim().toLowerCase();
      if (!q) return this.inMemoryProducts;
      return this.inMemoryProducts.filter((product) => {
        const name = (product.name || (product as any).nombre || "").toLowerCase();
        const unit = (product.unit || (product as any).unidad || "").toLowerCase();
        return name.includes(q) || unit.includes(q);
      });
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const doc = await firestore.collection("products").doc(id).get();
      if (!doc.exists) return null;
      return {
        id: doc.id,
        ...doc.data(),
      } as Product;
    } catch (error: any) {
      console.warn("Advertencia en Firestore Product.findById:", error.message);
      return null;
    }
  }

  async update(id: string, productData: Partial<Product>): Promise<void> {
    try {
      await firestore.collection("products").doc(id).update(productData);
    } catch (error: any) {
      console.warn("Advertencia al actualizar producto en Firestore:", error?.message || error);
    }
    const idx = this.inMemoryProducts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.inMemoryProducts[idx] = { ...this.inMemoryProducts[idx], ...productData };
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await firestore.collection("products").doc(id).delete();
    } catch (error: any) {
      console.warn("Advertencia al eliminar producto en Firestore:", error?.message || error);
    }
    this.inMemoryProducts = this.inMemoryProducts.filter((p) => p.id !== id);
  }
}
