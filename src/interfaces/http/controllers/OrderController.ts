import { Request, Response } from "express";
import { OrderFirestoreRepository } from "../../../infrastructure/firestore/OrderFirestoreRepository";
import { CreateOrderUseCase } from "../../../application/use-cases/order/CreateOrderUseCase";
import { GetMyOrdersUseCase } from "../../../application/use-cases/order/GetMyOrdersUseCase";
import { GetAllOrdersUseCase } from "../../../application/use-cases/order/GetAllOrdersUseCase";
import { UpdateOrderStatusUseCase } from "../../../application/use-cases/order/UpdateOrderStatusUseCase";
import { MarkDeliveryCompletedUseCase } from "../../../application/use-cases/order/MarkDeliveryCompletedUseCase";
import { UpdateOrderDeliveriesUseCase } from "../../../application/use-cases/order/UpdateOrderDeliveriesUseCase";
import { AttachDeliveryProofUseCase } from "../../../application/use-cases/order/AttachDeliveryProofUseCase";
import { uploadDeliveryImage, uploadReceiptImage } from "../../../domain/services/ImageStorageService";
import { GetOrderByIdUseCase } from "../../../application/use-cases/order/GetOrderByIdUseCase";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { GetOrderTrackingUseCase } from "../../../application/use-cases/order/GetOrderTrackingUseCase";
import { LocationFirestoreRepository } from "../../../infrastructure/firestore/LocationFirestoreRepository";
import { ProductFirestoreRepository } from "../../../infrastructure/firestore/ProductFirestoreRepository";
import { TripFirestoreRepository } from "../../../infrastructure/firestore/TripFirestoreRepository";
import { IdempotencyFirestoreRepository } from "../../../infrastructure/firestore/IdempotencyFirestoreRepository";



const tripRepo = new TripFirestoreRepository();
const locationRepo = new LocationFirestoreRepository();
const orderRepo = new OrderFirestoreRepository();
const userRepo = new UserFirestoreRepository();
const productRepo = new ProductFirestoreRepository();
const idempotencyRepo = new IdempotencyFirestoreRepository();
export class OrderController {
  constructor(
    private createOrderUseCase = new CreateOrderUseCase(orderRepo, productRepo, idempotencyRepo, userRepo),
    private getMyOrdersUseCase = new GetMyOrdersUseCase(orderRepo, userRepo),
    private getOrderTrackingUseCase = new GetOrderTrackingUseCase(orderRepo, tripRepo, locationRepo),
    private getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepo),
    private getAllOrdersUseCase = new GetAllOrdersUseCase(orderRepo, userRepo),
    private updateOrderStatusUseCase = new UpdateOrderStatusUseCase(orderRepo, tripRepo),
    private markDeliveryCompletedUseCase = new MarkDeliveryCompletedUseCase(orderRepo),
    private attachDeliveryProofUseCase = new AttachDeliveryProofUseCase(orderRepo),
    private updateOrderDeliveriesUseCase = new UpdateOrderDeliveriesUseCase(orderRepo)
  ) {}
    async create(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      let receiptImageUrl = req.body.receiptImage;
      // Si el cliente adjuntó el archivo del comprobante, subirlo a Firebase Storage
      if (req.file) {
        receiptImageUrl = await uploadReceiptImage(req.file, authUser?.uid || "general");
      }
      const idempotencyKey =
        (req.headers["idempotency-key"] as string) ||
        (req.headers["x-idempotency-key"] as string) ||
        req.body?.idempotencyKey;
      const { orderId, orderNumber } = await this.createOrderUseCase.execute({
        ...req.body,
        receiptImage: receiptImageUrl,
        userId: authUser?.uid,
        idempotencyKey,
      });
      res.status(201).json({ success: true, orderId, orderNumber });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al crear el pedido" });
    }
  }

    async getTracking(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const authUser = (req as any).user;

      const tracking = await this.getOrderTrackingUseCase.execute(
        id,
        authUser?.uid,
        authUser?.userType
      );

      if (!tracking) {
        return res.status(404).json({ success: false, message: "Orden no encontrada" });
      }

      res.status(200).json({ success: true, tracking });
    } catch (error: any) {
      const status = error.message?.includes("permiso") ? 403 : 500;
      res.status(status).json({ success: false, message: error.message || "Error al obtener el tracking" });
    }
  }

  async getMyOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.uid;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Usuario no autenticado" });
      }

      const { search, status } = req.query;
      const orders = await this.getMyOrdersUseCase.execute(userId, {
        search: typeof search === "string" ? search : undefined,
        status: typeof status === "string" ? status : undefined,
      });

      res.status(200).json({ success: true, orders });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener los pedidos" });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.getOrderByIdUseCase.execute(id);
      if (!order) {
        return res.status(404).json({ success: false, message: "Orden no encontrada" });
      }

      const authUser = (req as any).user;
      if (authUser?.userType === "client" && order.userId !== authUser.uid) {
        return res.status(403).json({ success: false, message: "No tienes permiso para ver esta orden" });
      }

      res.status(200).json({ success: true, order });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener la orden" });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { status, deliveryType, userId, withoutTrip } = req.query;
      const filters: any = {};
      if (typeof status === "string" && status.trim()) filters.status = status.trim();
      if (typeof deliveryType === "string" && deliveryType.trim()) filters.deliveryType = deliveryType.trim();
      if (typeof userId === "string" && userId.trim()) filters.userId = userId.trim();
      if (withoutTrip !== undefined) filters.withoutTrip = String(withoutTrip).toLowerCase() === "true";

      const orders = await this.getAllOrdersUseCase.execute(filters);
      res.status(200).json({ success: true, orders });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener las órdenes" });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, reason, driverId } = req.body;
      await this.updateOrderStatusUseCase.execute(id, status, reason, driverId);
      res.status(200).json({ success: true, message: "Orden actualizada correctamente" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al actualizar la orden" });
    }
  }

  async completeDelivery(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);
      if (isNaN(parsedIndex)) return res.status(400).json({ success: false, message: "Índice inválido" });

      await this.markDeliveryCompletedUseCase.execute({ orderId: id, index: parsedIndex, comment: req.body?.comment });
      res.status(200).json({ success: true, message: "Entrega marcada como completada" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Error al actualizar la entrega" });
    }
  }

  async completeDeliveryWithProof(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);
      if (isNaN(parsedIndex)) return res.status(400).json({ success: false, message: "Índice de entrega inválido" });

      const imageUrl = req.file ? await uploadDeliveryImage(req.file, id, parsedIndex) : undefined;
      await this.markDeliveryCompletedUseCase.execute({
        orderId: id,
        index: parsedIndex,
        comment: req.body?.comment,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: "Entrega completada y comprobante guardado exitosamente",
        imageUrl,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al completar la entrega" });
    }
  }

  async attachToDelivery(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);
      if (isNaN(parsedIndex)) return res.status(400).json({ success: false, message: "Índice de entrega inválido" });

      const imageUrl = req.file ? await uploadDeliveryImage(req.file, id, parsedIndex) : undefined;
      await this.attachDeliveryProofUseCase.execute({
        orderId: id,
        index: parsedIndex,
        comment: req.body?.comment,
        imageUrl,
      });

      res.status(200).json({ success: true, message: "Entrega actualizada correctamente", url: imageUrl });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al actualizar la entrega" });
    }
  }

  async updateDeliveries(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { deliveryType, deliveries } = req.body;
      const updatedOrder = await this.updateOrderDeliveriesUseCase.execute(id, deliveryType, deliveries);
      res.status(200).json({
        success: true,
        message: "Entregas actualizadas y guardadas correctamente",
        order: updatedOrder,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Error al actualizar las entregas" });
    }
  }
}
