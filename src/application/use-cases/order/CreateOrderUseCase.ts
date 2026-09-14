import { Order, OrderItem } from "../../../domain/entities/Order";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { CreateOrderDto } from "../../dtos/OrderDtos";

export class CreateOrderUseCase {
  private synthIDDetector = new SynthIDDetectorService();

  constructor(
    private orderRepo: OrderRepository,
    private productRepo?: ProductRepository
  ) {}

  async execute(
    data: CreateOrderDto
  ): Promise<{ orderId: string; orderNumber: number }> {
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
      let unitPrice = item.unitPrice || 0;
      let name = item.name || "Producto";
      let unit = item.unit || "fundas";

      if (this.productRepo) {
        const product = await this.productRepo.findById(item.productId);
        if (product) {
          name = product.name;
          unit = product.unit || unit;
          unitPrice = product.price;
        } else if (!item.unitPrice) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
      }

      const subtotal = unitPrice * item.quantity;

      validatedItems.push({
        productId: item.productId,
        name,
        unit,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });
    }

    const order: Order = {
      orderNumber,
      userId: data.userId,
      deliveryType: data.deliveryType,
      deliveries: (data.deliveries ?? []).map((d) => ({
        ...d,
        status: "pending",
        images: [],
      })),
      items: validatedItems,
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

    return await this.orderRepo.create(order);
  }
}