import { Product } from "../entities/Product";

export interface ProductRepository {
create(product: Product): Promise<string>; 
  getAll(): Promise<Product[]>;
  search(query?: string): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  update(id: string, productData: Partial<Product>): Promise<void>;
  delete(id: string): Promise<void>;
}
