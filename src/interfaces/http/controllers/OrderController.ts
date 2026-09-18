import { Request, Response } from "express";
import { OrderFirestoreRepository } from "../../../infrastructure/firestore/OrderFirestoreRepository";
import { CreateOrderUseCase } from "../../../application/use-cases/order/CreateOrderUseCase";
import { GetMyOrdersUseCase } from "../../../application/use-cases/order/GetMyOrdersUseCase";
import { GetAllOrdersUseCase } from "../../../application/use-cases/order/GetAllOrdersUseCase";
import { UpdateOrderStatusUseCase } from "../../../application/use-cases/order/UpdateOrderStatusUseCase";
import { MarkDeliveryCompletedUseCase } from "../../../application/use-cases/order/MarkDeliveryCompletedUseCase";
import { UpdateOrderDeliveriesUseCase } from "../../../application/use-cases/order/UpdateOrderDeliveriesUseCase";
import { AttachDeliveryProofUseCase } from "../../../application/use-cases/order/AttachDeliveryProofUseCase";
import { uploadDeliveryImage } from "../../../domain/services/ImageStorageService";
import { GetOrderByIdUseCase } from "../../../application/use-cases/order/GetOrderByIdUseCase";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { GetOrderTrackingUseCase } from "../../../application/use-cases/order/GetOrderTrackingUseCase";
import { LocationFirestoreRepository } from "../../../infrastructure/firestore/LocationFirestoreRepository";
import { ProductFirestoreRepository } from "../../../infrastructure/firestore/ProductFirestoreRepository";
import { TripFirestoreRepository } from "../../../infrastructure/firestore/TripFirestoreRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";

// Proveedores de infraestructura por defecto para inyección de dependencias
const defaultTripRepo = new TripFirestoreRepository();
const defaultLocationRepo = new LocationFirestoreRepository();
const defaultOrderRepo = new OrderFirestoreRepository();
const defaultUserRepo = new UserFirestoreRepository();
const defaultProductRepo = new ProductFirestoreRepository();

const defaultCreateOrderUseCase = new CreateOrderUseCase(defaultOrderRepo, defaultProductRepo);
const defaultGetMyOrdersUseCase = new GetMyOrdersUseCase(defaultOrderRepo, defaultUserRepo);
const defaultGetOrderTrackingUseCase = new GetOrderTrackingUseCase(defaultOrderRepo, defaultTripRepo, defaultLocationRepo);
const defaultGetOrderByIdUseCase = new GetOrderByIdUseCase(defaultOrderRepo);
const defaultGetAllOrdersUseCase = new GetAllOrdersUseCase(defaultOrderRepo, defaultUserRepo);
const defaultUpdateOrderStatusUseCase = new UpdateOrderStatusUseCase(defaultOrderRepo, defaultTripRepo);
const defaultMarkDeliveryCompletedUseCase = new MarkDeliveryCompletedUseCase(defaultOrderRepo);
const defaultAttachDeliveryProofUseCase = new AttachDeliveryProofUseCase(defaultOrderRepo);
const defaultUpdateOrderDeliveriesUseCase = new UpdateOrderDeliveriesUseCase(defaultOrderRepo);

export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase = defaultCreateOrderUseCase,
    private getMyOrdersUseCase: GetMyOrdersUseCase = defaultGetMyOrdersUseCase,
    private getOrderTrackingUseCase: GetOrderTrackingUseCase = defaultGetOrderTrackingUseCase,
    private getOrderByIdUseCase: GetOrderByIdUseCase = defaultGetOrderByIdUseCase,
    private getAllOrdersUseCase: GetAllOrdersUseCase = defaultGetAllOrdersUseCase,
    private updateOrderStatusUseCase: UpdateOrderStatusUseCase = defaultUpdateOrderStatusUseCase,
    private markDeliveryCompletedUseCase: MarkDeliveryCompletedUseCase = defaultMarkDeliveryCompletedUseCase,
    private attachDeliveryProofUseCase: AttachDeliveryProofUseCase = defaultAttachDeliveryProofUseCase,
    private updateOrderDeliveriesUseCase: UpdateOrderDeliveriesUseCase = defaultUpdateOrderDeliveriesUseCase,
    private orderRepo: OrderRepository = defaultOrderRepo
  ) {}

  async create(req: Request, res: Response) {
    try {
      const {
        deliveryType,
        deliveryAddress,
        deliveries,
        items,
        comments,
        receiptImage,
        paymentMethod,
        bankAccountId,
        creditNote,
      } = req.body;
      const userId = (req as any).user?.uid;
      if (!userId || !deliveryType || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos requeridos",
        });
      }

      const { orderId, orderNumber } = await this.createOrderUseCase.execute({
        userId,
        deliveryType,
        deliveryAddress,
        deliveries,
        items,
        comments,
        receiptImage,
        paymentMethod,
        bankAccountId,
        creditNote,
      });

      res.status(201).json({
        success: true,
        orderId,
        orderNumber,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al crear el pedido",
      });
    }
  }

  async getTracking(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderRepo.getById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Orden no encontrada",
        });
      }

      // OWASP API1 (BOLA): Clients can only track their own orders
      const authUser = (req as any).user;
      if (authUser && authUser.userType === "client" && order.userId !== authUser.uid) {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para ver el tracking de esta orden",
        });
      }

      const tracking = await this.getOrderTrackingUseCase.execute(id);
      res.status(200).json({
        success: true,
        tracking,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el tracking de la orden",
      });
    }
  }

  async getMyOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.uid;
      const { search, status } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      const orders = await this.getMyOrdersUseCase.execute(userId, {
        search: typeof search === "string" ? search : undefined,
        status: typeof status === "string" ? status : undefined,
      });

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los pedidos",
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.getOrderByIdUseCase.execute(id);

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Orden no encontrada" });
      }

      // OWASP API1 (BOLA): Clients can only view their own orders
      const authUser = (req as any).user;
      if (authUser && authUser.userType === "client" && order.userId !== authUser.uid) {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para ver esta orden",
        });
      }

      res.status(200).json({ success: true, order });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener la orden",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { status, deliveryType, userId, withoutTrip } = req.query;
      const filters: any = {};
      if (typeof status === "string" && status !== "undefined" && status.trim()) {
        filters.status = status.trim();
      }
      if (typeof deliveryType === "string" && deliveryType.trim()) {
        filters.deliveryType = deliveryType.trim();
      }
      if (typeof userId === "string" && userId.trim()) {
        filters.userId = userId.trim();
      }
      if (withoutTrip !== undefined) {
        filters.withoutTrip = String(withoutTrip).toLowerCase() === "true";
      }
      const orders = await this.getAllOrdersUseCase.execute(filters);
      res.status(200).json({ success: true, orders });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener las órdenes",
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, reason, driverId } = req.body;

      if (!id || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Estado inválido o faltan datos",
        });
      }

      await this.updateOrderStatusUseCase.execute(id, status, reason, driverId);

      res.status(200).json({
        success: true,
        message: "Orden actualizada correctamente",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar la orden",
      });
    }
  }

  async completeDelivery(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);

      if (isNaN(parsedIndex)) {
        return res.status(400).json({
          success: false,
          message: "Índice inválido",
        });
      }

      await this.markDeliveryCompletedUseCase.execute({
        orderId: id,
        index: parsedIndex,
        comment: req.body?.comment,
      });

      res.status(200).json({
        success: true,
        message: "Entrega marcada como completada",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al actualizar la entrega",
      });
    }
  }

  async completeDeliveryWithProof(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);
      const comment = req.body.comment;
      const image = req.file;

      if (isNaN(parsedIndex)) {
        return res.status(400).json({
          success: false,
          message: "Índice de entrega inválido",
        });
      }

      let imageUrl: string | undefined;
      if (image) {
        imageUrl = await uploadDeliveryImage(image, id, parsedIndex);
      }

      await this.markDeliveryCompletedUseCase.execute({
        orderId: id,
        index: parsedIndex,
        comment,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: "Entrega completada y comprobante guardado exitosamente",
        imageUrl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al completar la entrega",
      });
    }
  }

  async attachToDelivery(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index, 10);
      const comment = req.body.comment;
      const image = req.file;

      if (isNaN(parsedIndex)) {
        return res.status(400).json({
          success: false,
          message: "Índice de entrega inválido",
        });
      }

      let imageUrl: string | undefined;
      if (image) {
        imageUrl = await uploadDeliveryImage(image, id, parsedIndex);
      }

      await this.attachDeliveryProofUseCase.execute({
        orderId: id,
        index: parsedIndex,
        comment,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: "Entrega actualizada correctamente",
        url: imageUrl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar la entrega",
      });
    }
  }

  async updateDeliveries(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { deliveryType, deliveries } = req.body;

      if (!id || !deliveryType) {
        return res.status(400).json({
          success: false,
          message: "id y deliveryType son requeridos",
        });
      }

      const updatedOrder = await this.updateOrderDeliveriesUseCase.execute(
        id,
        deliveryType,
        deliveries
      );

      res.status(200).json({
        success: true,
        message: "Entregas actualizadas y guardadas correctamente",
        order: updatedOrder,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al actualizar las entregas",
      });
    }
  }
}
