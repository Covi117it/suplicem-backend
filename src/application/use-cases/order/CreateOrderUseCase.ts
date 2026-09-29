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
      const unit = product.unit || "fundas";
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

    const order: Order = {
      orderNumber,
      userId: data.userId,
      userPhone,
      userNames,
      userLastNames,
      userEmail,
      deliveryType: data.deliveryType,
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