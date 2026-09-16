import { Router } from "express";
import { TripController } from "../controllers/TripController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import { CreateTripSchema, UpdateTripStatusSchema } from "../schemas/tripSchemas";

export const tripRoutes = (router: Router) => {
  const tripController = new TripController();

  router.get(
    "/trips/driver/active",
    authenticate,
    requireRole(["driver"]),
    async (req, res) => {
      await tripController.getDriverActiveTrip(req, res);
    }
  );

  // 1. Crear viaje (Solo Administradores)
  router.post(
    "/trips",
    authenticate,
    requireRole(["admin"]),
    validate(CreateTripSchema),
    async (req, res) => {
      await tripController.create(req, res);
    }
  );

  // 1b. Crear viaje con órdenes asociadas
  router.post("/trips/create-with-orders", authenticate, async (req, res) => {
    await tripController.createWithOrders(req, res);
  });

  // 2. Actualizar estado del viaje (Conductores y Administradores)
  router.post(
    "/trips/status/update",
    authenticate,
    requireRole(["driver", "admin"]),
    validate(UpdateTripStatusSchema),
    async (req, res) => {
      await tripController.updateTripStatus(req, res);
    }
  );

  router.patch("/trips/:id/status", authenticate, async (req, res) => {
    await tripController.updateTripStatus(req, res);
  });

  // 3. Ver todos los viajes (Solo Administradores)
  router.get(
    "/trips",
    authenticate,
    requireRole(["admin"]),
    async (req, res) => {
      await tripController.getAll(req, res);
    }
  );

  // 4. Viajes disponibles (Conductores y Administradores)
  router.get(
    "/trips/available",
    authenticate,
    requireRole(["driver", "admin"]),
    async (req, res) => {
      await tripController.getAvailable(req, res);
    }
  );

  // 5. Historial de viajes del conductor (Solo Conductores)
  router.get(
    "/trips/driver/history",
    authenticate,
    requireRole(["driver"]),
    async (req, res) => {
      await tripController.getDriverTripHistory(req, res);
    }
  );

  // 6. Viaje actual activo del conductor (Solo Conductores)
  router.get(
    "/trips/driver/actual",
    authenticate,
    requireRole(["driver"]),
    async (req, res) => {
      await tripController.getDriverActualTrips(req, res);
    }
  );

  // 7. Aceptar viaje (Solo Conductores)
  router.patch(
    "/trips/:id/accept",
    authenticate,
    requireRole(["driver"]),
    async (req, res) => {
      await tripController.accept(req, res);
    }
  );

  // 8. Detalle por ID de viaje
  router.get("/trips/:id", authenticate, async (req, res) => {
    await tripController.getById(req, res);
  });

  // 9. Detalle por ID de orden
  router.get("/trips/order/:id", authenticate, async (req, res) => {
    await tripController.getTripByOrderId(req, res);
  });
};