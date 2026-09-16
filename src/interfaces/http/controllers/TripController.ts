import { Request, Response } from "express";
import { TripFirestoreRepository } from "../../../infrastructure/firestore/TripFirestoreRepository";
import { CreateTripUseCase } from "../../../application/use-cases/trip/CreateTripUseCase";
import { GetAvailableTripsUseCase } from "../../../application/use-cases/trip/GetAvailableTripsUseCase";
import { AcceptTripUseCase } from "../../../application/use-cases/trip/AcceptTripUseCase";
import { GetTripDetailsUseCase } from "../../../application/use-cases/trip/GetTripDetailsUseCase";
import { GetAllTripsUseCase } from "../../../application/use-cases/trip/GetAllTripsUseCase";
import { UpdateTripStatusUseCase } from "../../../application/use-cases/trip/UpdateTripStatusUseCase";
import { GetDriverTripHistoryUseCase } from "../../../application/use-cases/trip/GetDriverTripHistoryUseCase";
import { GetTripByIdUseCase } from "../../../application/use-cases/trip/GetTripByIdUseCase";
import { GetDriverActualTripsUseCase } from "../../../application/use-cases/trip/GetDriverActualTripsUseCase";
import { GetTripByOrderIdUseCase } from "../../../application/use-cases/trip/GetTripByOrderIdUseCase";
import { GetDriverActiveTripUseCase } from "../../../application/use-cases/trip/GetDriverActiveTripUseCase";
import { CompleteTripUseCase } from "../../../application/use-cases/trip/CompleteTripUseCase";
import { CreateTripWithOrdersUseCase } from "../../../application/use-cases/trip/CreateTripWithOrdersUseCase";

const tripRepo = new TripFirestoreRepository();
const createTripUseCase = new CreateTripUseCase(tripRepo);
const createTripWithOrdersUseCase = new CreateTripWithOrdersUseCase(tripRepo);
const getAvailableTripsUseCase = new GetAvailableTripsUseCase(tripRepo);
const getDriverTripHistoryUseCase = new GetDriverTripHistoryUseCase(tripRepo);
const getDriverActualTripsUseCase = new GetDriverActualTripsUseCase(tripRepo);
const getAllTripsUseCase = new GetAllTripsUseCase(tripRepo);
const acceptTripUseCase = new AcceptTripUseCase(tripRepo);
const getTripDetailsUseCase = new GetTripDetailsUseCase(tripRepo);
const getTripByOrderIdUseCase = new GetTripByOrderIdUseCase(tripRepo);
const updateTripStatusUseCase = new UpdateTripStatusUseCase(tripRepo);
const completeTripUseCase = new CompleteTripUseCase(tripRepo);
const getTripByIdUseCase = new GetTripByIdUseCase(tripRepo);
const getDriverActiveTripUseCase = new GetDriverActiveTripUseCase(tripRepo);

export class TripController {
  async create(req: Request, res: Response) {
    try {
      const { tripNumber, orderIds, comments, totalTons } = req.body;

      const tripId = await createTripUseCase.execute({
        tripNumber,
        orderIds,
        comments,
        totalTons,
      });

      res.status(201).json({
        success: true,
        message: "Viaje creado correctamente",
        tripId,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al crear el viaje",
      });
    }
  }

  async getAvailable(req: Request, res: Response) {
    try {
      const trips = await getAvailableTripsUseCase.execute();

      res.status(200).json({
        success: true,
        trips,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los viajes disponibles",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const trips = await getAllTripsUseCase.execute();

      res.status(200).json({
        success: true,
        trips,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los viajes",
      });
    }
  }

  async getDriverTripHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      const trips = await getDriverTripHistoryUseCase.execute(userId);

      res.status(200).json({
        success: true,
        trips,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los viajes disponibles",
      });
    }
  }

  async getDriverActualTrips(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      const trips = await getDriverActualTripsUseCase.execute(userId);

      res.status(200).json({
        success: true,
        trips,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los viajes disponibles",
      });
    }
  }

  async accept(req: Request, res: Response) {
    try {
      const tripId = req.params.id;
      const driverId = req.user?.uid;

      if (!driverId) {
        return res.status(403).json({
          success: false,
          message: "Solo conductores pueden aceptar viajes",
        });
      }

      const trip = await getTripByIdUseCase.execute(tripId);

      if (trip?.status !== "available") {
        return res.status(403).json({
          success: false,
          message: `El viaje ${trip?.tripNumber} ya no está disponible`,
        });
      }

      await acceptTripUseCase.execute(tripId, driverId);

      res.status(200).json({
        success: true,
        message: "Viaje aceptado correctamente",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al aceptar el viaje",
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const tripId = req.params.id;

      const trip = await getTripDetailsUseCase.execute(tripId);

      res.status(200).json({
        success: true,
        trip,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "Error al obtener el viaje",
      });
    }
  }

  async getTripByOrderId(req: Request, res: Response) {
    try {
      const orderId = req.params.id;

      const trip = await getTripByOrderIdUseCase.execute(orderId);

      res.status(200).json({
        success: true,
        trip,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "Error al obtener el viaje",
      });
    }
  }

   async getDriverActiveTrip(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }
      const trip = await getDriverActiveTripUseCase.execute(userId);
      res.status(200).json({
        success: true,
        hasActiveTrip: Boolean(trip),
        trip,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener el viaje activo",
      });
    }
  }

  async updateTripStatus(req: Request, res: Response) {
    try {
      const tripId = req.params.id || req.body.tripId;
      const { status } = req.body;

      if (!tripId || !status) {
        return res.status(400).json({
          success: false,
          message: "tripId y status son requeridos",
        });
      }

      if (status === "completed") {
        await completeTripUseCase.execute(tripId);
      } else {
        await updateTripStatusUseCase.execute(tripId, status);
      }

      res.status(200).json({
        success: true,
        message: `Status actualizado correctamente a ${status}`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al actualizar el status",
      });
    }
  }

  async createWithOrders(req: Request, res: Response) {
    try {
      const { tripNumber, orderIds, driverId, totalTons, comments, deliveries } = req.body;

      const tripId = await createTripWithOrdersUseCase.execute({
        tripNumber,
        orderIds,
        driverId,
        totalTons,
        comments,
        deliveries,
      });

      res.status(201).json({
        success: true,
        message: "Viaje con órdenes creado correctamente",
        tripId,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al crear el viaje con órdenes",
      });
    }
  }
}
