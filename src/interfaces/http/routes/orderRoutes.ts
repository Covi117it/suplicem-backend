import { Router } from "express";
import { normalizeOrderData } from "../middlewares/normalizeOrderData";
import { OrderController } from "../controllers/OrderController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { ordersLimiter } from "../middlewares/rateLimiter";
import { validate } from "../middlewares/validate";
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  UpdateOrderDeliveriesSchema,
  CompleteDeliverySchema,
  AttachDeliveryProofSchema,
} from "../schemas/orderSchemas";
import { validateImageFile } from "../middlewares/validateImageFile";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB límite
});

export const orderRoutes = (router: Router) => {
  const orderController = new OrderController();
  router.get("/orders/:id/tracking", authenticate, async (req, res) => {
    await orderController.getTracking(req, res);
  });

  router.post(
    "/orders",
    ordersLimiter,
    authenticate,
    requireRole(["client"]),
    upload.single("receiptImage"),
    normalizeOrderData,
    validate(CreateOrderSchema),
    async (req, res) => {
      await orderController.create(req, res);
    }
  );

  // 2. Mis órdenes (Clientes)
  router.get("/orders/my", authenticate, async (req, res) => {
    await orderController.getMyOrders(req, res);
  });

  // 3. Ver todas las órdenes (Solo Administradores)
  router.get(
    "/orders",
    authenticate,
    requireRole(["admin"]),
    async (req, res) => {
      await orderController.getAll(req, res);
    }
  );

  // 4. Ver orden por ID (Cualquier usuario autenticado involucrado)
  router.get("/orders/:id", authenticate, async (req, res) => {
    await orderController.getById(req, res);
  });

  // 5. Aprobar o rechazar orden (Solo Administradores)
  router.patch(
    "/orders/:id/status",
    authenticate,
    requireRole(["admin"]),
    validate(UpdateOrderStatusSchema),
    async (req, res) => {
      await orderController.updateStatus(req, res);
    }
  );

  // 6. Asignar/actualizar entregas (Administradores)
  router.put(
    "/orders/:id/deliveries",
    authenticate,
    requireRole(["admin"]),
    validate(UpdateOrderDeliveriesSchema),
    async (req, res) => {
      await orderController.updateDeliveries(req, res);
    }
  );

  router.patch(
    "/orders/:id/deliveries",
    authenticate,
    requireRole(["admin"]),
    validate(UpdateOrderDeliveriesSchema),
    async (req, res) => {
      await orderController.updateDeliveries(req, res);
    }
  );

  // 7. Marcar entrega completada (Conductores y Administradores)
  router.patch(
    "/orders/:id/deliveries/:index",
    authenticate,
    requireRole(["driver", "admin"]),
    validate(CompleteDeliverySchema),
    async (req, res) => {
      await orderController.completeDelivery(req, res);
    }
  );

  // 8. Adjuntar comprobante fotográfico a entrega (Conductores y Administradores)
  router.patch(
    "/orders/:id/deliveries/:index/attachment",
    authenticate,
    requireRole(["driver", "admin"]),
    upload.single("image"),
    validateImageFile,
    validate(AttachDeliveryProofSchema),
    async (req, res) => {
      await orderController.attachToDelivery(req, res);
    }
  );

  // 9. Completar entrega con comprobante en una sola operación atómica (Conductores y Administradores)
  router.post(
    "/orders/:id/deliveries/:index/complete",
    authenticate,
    requireRole(["driver", "admin"]),
    upload.single("image"),
    validateImageFile,
    validate(CompleteDeliverySchema),
    async (req, res) => {
      await orderController.completeDeliveryWithProof(req, res);
    }
  );
};