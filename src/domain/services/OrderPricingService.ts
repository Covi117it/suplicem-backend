import { Product } from "../entities/Product";
import { OrderItem } from "../entities/Order";

export class OrderPricingService {
  validateAndCalculateItem(
    product: Product,
    requestedQuantity: number,
    isSellerAssisted: boolean = false
  ): OrderItem {
    if (requestedQuantity <= 0) {
      throw new Error(`La cantidad para el producto ${product.name} debe ser mayor a cero.`);
    }

    const unitPrice = product.price;
    const name = product.name;
    const isCement = name.toLowerCase().includes("cemento") || product.unit === "fundas";
    const unit = isCement ? "fundas" : (product.unit || "fundas");

    // 1. Regla de fraccionamiento mínimo (50 fundas) y múltiplos
    if (isCement) {
      if (!isSellerAssisted && (requestedQuantity < 50 || requestedQuantity > 1000 || requestedQuantity % 50 !== 0)) {
        throw new Error(
          `La cantidad para ${name} debe ser entre 50 y 1,000 fundas (en fracciones de 50). Para compras mayores a 1,000 fundas, gestione su pedido con un vendedor.`
        );
      } else if (isSellerAssisted && (requestedQuantity < 50 || requestedQuantity % 50 !== 0)) {
        throw new Error(
          `La cantidad para ${name} debe ser a partir de 50 fundas y en múltiplos de 50.`
        );
      }
    }

    // 2. Motor de Lotes y Tarifas por Volumen
    const lotSize = product.lotSize || (isCement ? 500 : 0);
    const lotPrice = product.lotPrice || (lotSize > 0 ? unitPrice * lotSize : 0);
    let subtotal = Number((unitPrice * requestedQuantity).toFixed(2));

    const directLotPrice = product.lotPrices?.[String(requestedQuantity)];
    if (directLotPrice !== undefined && Number(directLotPrice) > 0) {
      subtotal = Number(Number(directLotPrice).toFixed(2));
    } else if (lotSize > 0 && lotPrice > 0 && requestedQuantity >= lotSize) {
      const fullLots = Math.floor(requestedQuantity / lotSize);
      const remainderBags = requestedQuantity % lotSize;
      subtotal = Number((fullLots * lotPrice + remainderBags * unitPrice).toFixed(2));
    }

    return {
      productId: product.id || "",
      name,
      unit,
      quantity: requestedQuantity,
      unitPrice,
      subtotal,
      weightKg: product.weightKg,
    };
  }
}
