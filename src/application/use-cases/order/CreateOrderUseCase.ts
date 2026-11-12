import { Order, OrderItem } from "../../../domain/entities/Order";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { IdempotencyRepository } from "../../../domain/repositories/IdempotencyRepository";
import { GetDashboardSummaryUseCase } from "../dashboard/GetDashboardSummaryUseCase";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { TonnageCalculatorService } from "../../../domain/services/TonnageCalculatorService";
import { OrderPricingService } from "../../../domain/services/OrderPricingService";
import { OrderPolicyValidatorService } from "../../../domain/services/OrderPolicyValidatorService";
import { NotificationDispatcherService } from "../../services/NotificationDispatcherService";
import { CreateOrderDto } from "../../dtos/OrderDtos";

export class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo?: ProductRepository,
    private idempotencyRepo?: IdempotencyRepository,
    private userRepo?: UserRepository,
    private synthIDDetector: SynthIDDetectorService = new SynthIDDetectorService(),
    private tonnageCalculator: TonnageCalculatorService = new TonnageCalculatorService(),
    private pricingService: OrderPricingService = new OrderPricingService(),
    private policyValidator: OrderPolicyValidatorService = new OrderPolicyValidatorService(),
    private notificationDispatcher?: NotificationDispatcherService
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

    // 2. Análisis de riesgo del comprobante con IA
    let aiRiskFlag = false;
    let aiRiskScore = 0;
    let aiRiskReason = "";

    if (data.receiptImage) {
      const analysis = await this.synthIDDetector.analyzeImage(data.receiptImage);
      aiRiskFlag = analysis.isAIGenerated;
      aiRiskScore = analysis.riskScore;
      aiRiskReason = analysis.reason;
    }

    // 3. Validación y Tarificación de Productos delegada a OrderPricingService
    if (!this.productRepo) {
      throw new Error("Repositorio de productos no disponible.");
    }

    const isSellerAssisted = Boolean(data.createdBySellerId);
    const validatedItems: OrderItem[] = [];

    for (const item of data.items) {
      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new Error(`Producto no encontrado o no disponible: ${item.productId}`);
      }

      const validatedItem = this.pricingService.validateAndCalculateItem(
        product,
        item.quantity,
        isSellerAssisted
      );
      validatedItems.push(validatedItem);
    }

    // 4. Cálculo de Toneladas delegado a TonnageCalculatorService
    const calculatedTotalTons = this.tonnageCalculator.calculateTotalTons(validatedItems);

    // 5. Enriquecimiento de Usuario y Vendedor
    let userPhone = "";
    let userNames = "";
    let userLastNames = "";
    let userEmail = "";
    let assignedSellerId = data.createdBySellerId;

    if (this.userRepo && data.userId) {
      const client = await this.userRepo.getById(data.userId);

      // Aplicar políticas de negocio (SRP: Cartera de vendedor y elegibilidad de crédito)
      this.policyValidator.validateSellerPortfolio(client, data.createdBySellerId);
      this.policyValidator.validateCreditEligibility(client, data.paymentMethod);

      if (client) {
        userPhone = client.phone || "";
        userNames = client.names || "";
        userLastNames = client.lastNames || "";
        userEmail = client.email || "";
        if (!assignedSellerId && client.sellerId) {
          assignedSellerId = client.sellerId;
        }
      }
    }

    const orderNumber = await this.orderRepo.getNextOrderNumber();
    const resolvedDeliveryAddress =
      data.deliveryAddress ||
      (data.deliveries && data.deliveries.length > 0 && data.deliveries[0].address
        ? data.deliveries[0].address
        : undefined);

    // 6. Ensamblado de la Entidad Order
    const order: Order = {
      orderNumber,
      userId: data.userId,
      sellerId: assignedSellerId,
      createdBySellerId: data.createdBySellerId,
      userPhone,
      userNames,
      userLastNames,
      userEmail,
      deliveryType: data.deliveryType,
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
      receiptImage: data.receiptImage,
      status: "pending",
      createdAt: new Date().toISOString(),
      aiRiskFlag,
      aiRiskScore,
      aiRiskReason: aiRiskFlag ? aiRiskReason : undefined,
    };

    const result = await this.orderRepo.create(order);

    if (this.notificationDispatcher && assignedSellerId) {
      this.notificationDispatcher.notifyOrderCreated({
        orderNumber: result.orderNumber,
        sellerId: assignedSellerId,
        clientName: `${userNames} ${userLastNames}`.trim() || "Cliente",
        totalTons: calculatedTotalTons,
        address: resolvedDeliveryAddress?.description,
      }).catch((err) => console.warn("[Notification] Error al notificar orden creada:", err?.message || err));
    }

    // 7. Guardar resultado de la compra para futuros reintentos de red
    if (data.idempotencyKey && this.idempotencyRepo) {
      await this.idempotencyRepo.complete(data.idempotencyKey, data.userId, result);
    }

    GetDashboardSummaryUseCase.invalidateCache();

    return result;
  }
}
