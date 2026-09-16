import { Router } from "express";
import { OrderController } from "../controllers/OrderController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import { CreateOrderSchema, UpdateOrderStatusSchema } from "../schemas/orderSchemas";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export const orderRoutes = (router: Router) => {
  const orderController = new OrderController();

  router.get("/orders/:id/tracking", authenticate, async (req, res) => {
    await orderController.getTracking(req, res);
  });

  // 1. Crear orden (Clientes)
  router.post(
    "/orders",
    authenticate,
    requireRole(["client"]),
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
  router.put("/orders/:id/deliveries", authenticate, async (req, res) => {
    await orderController.updateDeliveries(req, res);
  });

  router.patch("/orders/:id/deliveries", authenticate, async (req, res) => {
    await orderController.updateDeliveries(req, res);
  });

  // 7. Marcar entrega completada (Conductores y Administradores)
  router.patch(
    "/orders/:id/deliveries/:index",
    authenticate,
    requireRole(["driver", "admin"]),
    async (req, res) => {
      await orderController.completeDelivery(req, res);
    }
  );

  // 7. Adjuntar comprobante fotográfico a entrega (Conductores y Administradores)
  router.patch(
    "/orders/:id/deliveries/:index/attachment",
    authenticate,
    requireRole(["driver", "admin"]),
    upload.single("image"),
    async (req, res) => {
      await orderController.attachToDelivery(req, res);
    }
  );

  // 8. Completar entrega con comprobante en una sola operación atómica (Conductores y Administradores)
  router.post(
    "/orders/:id/deliveries/:index/complete",
    authenticate,
    requireRole(["driver", "admin"]),
    upload.single("image"),
    async (req, res) => {
      await orderController.completeDeliveryWithProof(req, res);
    }
  );
};