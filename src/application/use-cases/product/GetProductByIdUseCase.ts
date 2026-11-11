import { Product } from "../../../domain/entities/Product";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string): Promise<Product | null> {
    if (!id || !id.trim()) return null;
    const all = await this.productRepo.getAll();
    const fromNormalizedList = all.find((p) => p.id === id);
    if (fromNormalizedList) return fromNormalizedList;
    return await this.productRepo.findById(id);
  }
}
