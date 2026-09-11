import { Request, Response } from "express";
import { OrderFirestoreRepository } from "../../../infrastructure/firestore/OrderFirestoreRepository";
import { CreateOrderUseCase } from "../../../application/use-cases/order/CreateOrderUseCase";
import { GetMyOrdersUseCase } from "../../../application/use-cases/order/GetMyOrdersUseCase";
import { GetAllOrdersUseCase } from "../../../application/use-cases/order/GetAllOrdersUseCase";
import { UpdateOrderStatusUseCase } from "../../../application/use-cases/order/UpdateOrderStatusUseCase";
import { MarkDeliveryCompletedUseCase } from "../../../application/use-cases/order/MarkDeliveryCompletedUseCase";
import { uploadDeliveryImage } from "../../../domain/services/ImageStorageService";
import { firestore } from "../../../config/firebase";
import { GetOrderByIdUseCase } from "../../../application/use-cases/order/GetOrderByIdUseCase";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { sendEmail } from "../../../infrastructure/services/EmailService";

const orderRepo = new OrderFirestoreRepository();
const userRepo = new UserFirestoreRepository();
const createOrderUseCase = new CreateOrderUseCase(orderRepo);
const getMyOrdersUseCase = new GetMyOrdersUseCase(orderRepo, userRepo);
const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepo);
const getAllOrdersUseCase = new GetAllOrdersUseCase(orderRepo, userRepo);
const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(orderRepo);
const markDeliveryCompletedUseCase = new MarkDeliveryCompletedUseCase(
  orderRepo
);

export class OrderController {
  async create(req: Request, res: Response) {
    try {
      const { deliveryType, deliveries, items, comments, receiptImage } = req.body;
      const userId = req.user?.uid;

      if (!userId || !deliveryType || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos requeridos",
        });
      }

      const { orderId, orderNumber } = await createOrderUseCase.execute({
        userId,
        deliveryType,
        deliveries,
        items,
        comments,
        receiptImage,
      });

      // try {
      //   await sendEmail(
      //     "dmartinezenfocado@gmail.com",
      //     `Orden ${orderNumber} creada satisfactoriamente`,
      //     `Hola, se creó la orden ${orderNumber}`
      //   );
      // } catch (error) {
      //   // Do Nothing
      // }

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

  async getMyOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      const orders = await getMyOrdersUseCase.execute(userId);

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
      const order = await getOrderByIdUseCase.execute(id);

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Orden no encontrada" });
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
      const { status } = req.query;

      const orders = await getAllOrdersUseCase.execute(`${status}`);

      res.status(200).json({
        success: true,
        orders,
      });
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
      const { status, reason } = req.body;

      if (!id || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Estado inválido o faltan datos",
        });
      }

      await updateOrderStatusUseCase.execute(id, status, reason);

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
      const parsedIndex = parseInt(index);

      if (isNaN(parsedIndex)) {
        return res.status(400).json({
          success: false,
          message: "Índice inválido",
        });
      }

      await markDeliveryCompletedUseCase.execute(id, parsedIndex);

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

  async attachToDelivery(req: Request, res: Response) {
    try {
      const { id, index } = req.params;
      const parsedIndex = parseInt(index);
      const comment = req.body.comment;
      const image = req.file;

      const ref = firestore.collection("orders").doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        return res
          .status(404)
          .json({ success: false, message: "Orden no encontrada" });
      }

      const data = snap.data();
      if (!data?.deliveries || !data.deliveries[parsedIndex]) {
        return res
          .status(400)
          .json({ success: false, message: "Entrega no encontrada" });
      }

      if (comment) {
        data.deliveries[parsedIndex].comment = comment;
      }

      if (image) {
        const url = await uploadDeliveryImage(image, id, parsedIndex);
        data.deliveries[parsedIndex].imageUrl = url;

        await ref.update({ deliveries: data.deliveries });

        res
          .status(200)
          .json({
            success: true,
            message: "Entrega actualizada correctamente",
            url
          });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar la entrega",
      });
    }
  }
}
