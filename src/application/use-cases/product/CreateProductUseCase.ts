import { Product } from "../../../domain/entities/Product";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";

export const STANDARD_CEMENT_LOTS = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);

export const buildProportionalLotPrices = (
  unitPrice: number,
  customLotPrices?: Record<string, number>
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const lot of STANDARD_CEMENT_LOTS) {
    const key = String(lot);
    const customVal = customLotPrices?.[key];
    result[key] =
      customVal !== undefined && Number(customVal) > 0
        ? Number(Number(customVal).toFixed(2))
        : Number((unitPrice * lot).toFixed(2));
  }
  return result;
};

export class CreateProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(data: Omit<Product, "id" | "createdAt">): Promise<string> {
    const isCement =
      data.unit === "fundas" || data.name.toLowerCase().includes("cemento");
    const resolvedLotSize = data.lotSize || (isCement ? 500 : undefined);
    const activeManualPrices = data.manualLotPrices || data.lotPrices;
    const resolvedLotPrices = isCement
      ? buildProportionalLotPrices(data.price, activeManualPrices)
      : data.lotPrices;
    const resolvedLotPrice =
      data.lotPrice !== undefined
        ? Number(data.lotPrice.toFixed(2))
        : resolvedLotSize && resolvedLotPrices?.[String(resolvedLotSize)]
        ? resolvedLotPrices[String(resolvedLotSize)]
        : resolvedLotSize
        ? Number((data.price * resolvedLotSize).toFixed(2))
        : undefined;

    const newProduct: Product = {
      ...data,
      lotSize: resolvedLotSize,
      lotPrice: resolvedLotPrice,
      lotPrices: resolvedLotPrices,
      manualLotPrices: activeManualPrices,
      createdAt: new Date().toISOString(),
    };

    return await this.productRepo.create(newProduct);
  }
}
