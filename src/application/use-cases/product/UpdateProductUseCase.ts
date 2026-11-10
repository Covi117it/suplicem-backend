import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { Product } from "../../../domain/entities/Product";
import { buildProportionalLotPrices } from "./CreateProductUseCase";

export class UpdateProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string, productData: Partial<Product>): Promise<void> {
    if (!id) {
      throw new Error("ID de producto requerido");
    }

    const existing = await this.productRepo.findById(id);
    const basePrice = productData.price ?? existing?.price ?? 0;
    const currentLotSize = productData.lotSize ?? existing?.lotSize ?? 500;
    const updatedData: Partial<Product> = { ...productData };

    // Si el cliente envía `manualLotPrices`, se toma como la fuente de verdad manual
    const activeCustomLots: Record<string, number> =
      productData.manualLotPrices !== undefined
        ? productData.manualLotPrices
        : (existing?.manualLotPrices || {});

    if (productData.lotPrice !== undefined && productData.lotSize !== undefined) {
      activeCustomLots[String(productData.lotSize)] = Number(
        productData.lotPrice.toFixed(2)
      );
    }

    if (basePrice > 0) {
      updatedData.lotPrices = buildProportionalLotPrices(
        basePrice,
        activeCustomLots
      );
      updatedData.manualLotPrices = activeCustomLots;
      updatedData.lotSize = currentLotSize;
      updatedData.lotPrice =
        updatedData.lotPrices[String(currentLotSize)] ??
        Number((basePrice * currentLotSize).toFixed(2));
    }

    await this.productRepo.update(id, updatedData);
  }
}
