import { Order, OrderItem } from "../../../domain/entities/Order";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { IdempotencyRepository } from "../../../domain/repositories/IdempotencyRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { CreateOrderDto } from "../../dtos/OrderDtos";

export class CreateOrderUseCase {
  private synthIDDetector = new SynthIDDetectorService();

  constructor(
    private orderRepo: OrderRepository,
    private productRepo?: ProductRepository,
    private idempotencyRepo?: IdempotencyRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(
    data: CreateOrderDto
  ): Promise<{ orderId: string; orderNumber: number }> {
    // 1. Control de Idempotencia: Verificar si esta compra ya fue procesada
    if (data.idempotencyKey && this.idempotencyRepo) {
      const reservation = await this.idempotencyRepo.reserve(data.idempotencyKey, data.userId);
      if (!reservation.reserved && reservation.existingRecord) {
        if (reservation.existingRecord.status === "completed") {
          return {
            orderId: reservation.existingRecord.orderId,
            orderNumber: reservation.existingRecord.orderNumber,
          };
        }
      }
    }

    const orderNumber = await this.orderRepo.getNextOrderNumber();

    let aiRiskFlag = false;
    let aiRiskScore = 0;
    let aiRiskReason = "";

    if (data.receiptImage) {
      const analysis = await this.synthIDDetector.analyzeImage(data.receiptImage);
      aiRiskFlag = analysis.isAIGenerated;
      aiRiskScore = analysis.riskScore;
      aiRiskReason = analysis.reason;
    }

    const validatedItems: OrderItem[] = [];

    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad para el producto ${item.productId} debe ser mayor a cero.`);
      }

      if (!this.productRepo) {
        throw new Error("Repositorio de productos no disponible.");
      }

      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new Error(`Producto no encontrado o no disponible: ${item.productId}`);
      }

      const unitPrice = product.price;
      const name = product.name;
      const isCement = name.toLowerCase().includes("cemento");
      const unit = isCement ? "fundas" : (product.unit || "fundas");
      const subtotal = Number((unitPrice * item.quantity).toFixed(2));

      validatedItems.push({
        productId: item.productId,
        name,
        unit,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });
    }

    let userPhone = "";
    let userNames = "";
    let userLastNames = "";
    let userEmail = "";

    if (this.userRepo) {
      try {
        const u = await this.userRepo.getById(data.userId);
        if (u) {
          userPhone = u.phone || "";
          userNames = u.names || "";
          userLastNames = u.lastNames || "";
          userEmail = u.email || "";
        }
      } catch (e) {
        console.warn("No se pudo obtener datos del usuario al crear orden:", e);
      }
    }

    const resolvedDeliveryAddress =
      data.deliveryAddress ||
      (data.deliveries && data.deliveries.length > 0 && data.deliveries[0].address
        ? data.deliveries[0].address
        : undefined);

    // Regla Oficial Suplicem:
    // - Cemento Especial (Blanco / Estructural) = 40.0 kg = 0.040 t (1,000 fundas = 40.00 t)
    // - Cemento Normal (Gris / Uso General) = 42.5 kg = 0.0425 t (1,000 fundas = 42.50 t)
    const calculatedTotalTons = validatedItems.reduce((acc, item) => {
      const count = Number(item.quantity) || 0;
      const itemName = (item.name || "").toLowerCase();
      const isCement = item.unit === "fundas" || !item.unit || itemName.includes("cemento");
      if (!isCement) {
        return acc + count;
      }
      const isSpecial =
        itemName.includes("blanco") ||
        itemName.includes("especial") ||
        itemName.includes("estructural") ||
        itemName.includes("40kg") ||
        itemName.includes("40 kg");
      const factor = isSpecial ? 0.0400 : 0.0425;
      const tons = Number((count * factor).toFixed(2));
      return acc + tons;
    }, 0);

    const order: Order = {
      orderNumber,
      userId: data.userId,
      userPhone,
      userNames,
      userLastNames,
      userEmail,
      deliveryType: data.deliveryType,
      deliveryPreference: data.deliveryPreference || "partial",
      totalTons: calculatedTotalTons,
      pendingBalance: calculatedTotalTons,
      deliveredTons: 0,
      deliveryAddress: resolvedDeliveryAddress,
      deliveries: (data.deliveries ?? []).map((d) => ({
        ...d,
        address: d.address || resolvedDeliveryAddress,
        status: "pending",
        images: [],
      })),
      items: validatedItems,
      paymentMethod: data.paymentMethod, 
      bankAccountId: data.bankAccountId, 
      creditNote: data.creditNote, 
      comments: data.comments || "",
      status: "pending",
      createdAt: new Date().toISOString(),
      aiRiskFlag,
      aiRiskScore,
      aiRiskReason: aiRiskFlag ? aiRiskReason : undefined,
    };

    if (data.receiptImage) {
      order.receiptImage = data.receiptImage;
    }

    const result = await this.orderRepo.create(order);

    // 2. Guardar resultado de la compra para futuros reintentos de red
    if (data.idempotencyKey && this.idempotencyRepo) {
      await this.idempotencyRepo.complete(data.idempotencyKey, data.userId, result);
    }

    return result;
  }
}