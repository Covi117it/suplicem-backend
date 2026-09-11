import { Order } from "../../../domain/entities/Order";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { CreateOrderDto } from "../../dtos/OrderDtos";

export class CreateOrderUseCase {
  private synthIDDetector = new SynthIDDetectorService();

  constructor(private orderRepo: OrderRepository) {}

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

    const order: Order = {
      orderNumber,
      userId: data.userId,
      deliveryType: data.deliveryType,
      deliveries: (data.deliveries ?? []).map((d) => ({
        ...d,
        status: "pending",
        images: [],
      })),
      items: data.items,
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
