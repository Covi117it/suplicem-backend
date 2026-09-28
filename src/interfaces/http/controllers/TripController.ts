import { Request, Response } from "express";
import { TripFirestoreRepository } from "../../../infrastructure/firestore/TripFirestoreRepository";
import { OrderFirestoreRepository } from "../../../infrastructure/firestore/OrderFirestoreRepository";
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
const orderRepo = new OrderFirestoreRepository();

export class TripController {
  constructor(
    private createTripUseCase = new CreateTripUseCase(tripRepo, orderRepo),
    private createTripWithOrdersUseCase = new CreateTripWithOrdersUseCase(tripRepo),
    private getAvailableTripsUseCase = new GetAvailableTripsUseCase(tripRepo),
    private getDriverTripHistoryUseCase = new GetDriverTripHistoryUseCase(tripRepo),
    private getDriverActualTripsUseCase = new GetDriverActualTripsUseCase(tripRepo),
    private getAllTripsUseCase = new GetAllTripsUseCase(tripRepo),
    private acceptTripUseCase = new AcceptTripUseCase(tripRepo),
    private getTripDetailsUseCase = new GetTripDetailsUseCase(tripRepo),
    private getTripByOrderIdUseCase = new GetTripByOrderIdUseCase(tripRepo),
    private updateTripStatusUseCase = new UpdateTripStatusUseCase(tripRepo),
    private completeTripUseCase = new CompleteTripUseCase(tripRepo),
    private getTripByIdUseCase = new GetTripByIdUseCase(tripRepo),
    private getDriverActiveTripUseCase = new GetDriverActiveTripUseCase(tripRepo)
  ) {}

  async create(req: Request, res: Response) {
    try {
      const tripId = await this.createTripUseCase.execute(req.body);
      res.status(201).json({ success: true, message: "Viaje creado correctamente", tripId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Error al crear el viaje" });
    }
  }

  async getAvailable(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const isDriver = String(user?.userType || "").trim().toLowerCase() === "driver";
      const driverId = isDriver ? user?.uid : undefined;
      const trips = await this.getAvailableTripsUseCase.execute(driverId);
      res.status(200).json({ success: true, trips });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener todos los viajes" });
    }
  }

  async getAll(_req: Request, res: Response) {
    try {
      const trips = await this.getAllTripsUseCase.execute();
      res.status(200).json({ success: true, trips });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener los viajes" });
    }
  }

  async getDriverTripHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) return res.status(401).json({ success: false, message: "Usuario no autenticado" });

      const trips = await this.getDriverTripHistoryUseCase.execute(userId);
      res.status(200).json({ success: true, trips });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener el historial" });
    }
  }

  async getDriverActualTrips(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) return res.status(401).json({ success: false, message: "Usuario no autenticado" });

      const trips = await this.getDriverActualTripsUseCase.execute(userId);
      res.status(200).json({ success: true, trips });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener viajes disponibles" });
    }
  }

  async accept(req: Request, res: Response) {
    try {
      const tripId = req.params.id;
      const driverId = req.user?.uid;
      if (!driverId) return res.status(403).json({ success: false, message: "Solo conductores pueden aceptar viajes" });

      await this.acceptTripUseCase.execute(tripId, driverId);
      res.status(200).json({ success: true, message: "Viaje aceptado correctamente" });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message || "Error al aceptar el viaje" });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const trip = await this.getTripDetailsUseCase.execute(req.params.id);
      res.status(200).json({ success: true, trip });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message || "Error al obtener el viaje" });
    }
  }

  async getTripByOrderId(req: Request, res: Response) {
    try {
      const trip = await this.getTripByOrderIdUseCase.execute(req.params.id);
      res.status(200).json({ success: true, trip });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message || "Error al obtener el viaje" });
    }
  }

  async getDriverActiveTrip(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) return res.status(401).json({ success: false, message: "Usuario no autenticado" });

      const trip = await this.getDriverActiveTripUseCase.execute(userId);
      res.status(200).json({ success: true, hasActiveTrip: Boolean(trip), trip });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener viaje activo" });
    }
  }

  async updateTripStatus(req: Request, res: Response) {
    try {
      const tripId = req.params.id || req.body.tripId;
      const { status } = req.body;
      if (!tripId || !status) return res.status(400).json({ success: false, message: "tripId y status son requeridos" });
      const authUser = (req as any).user;
      const userId = authUser?.uid;
      const userRole = authUser?.userType;
      if (status === "completed") {
        await this.completeTripUseCase.execute(tripId, userId, userRole);
      } else {
        await this.updateTripStatusUseCase.execute(tripId, status, userId, userRole);
      }
      res.status(200).json({ success: true, message: `Status actualizado correctamente a ${status}` });
    } catch (error: any) {
      const status = error.message?.includes("permiso") ? 403 : error.message?.includes("encontrado") ? 404 : 400;
      res.status(status).json({ success: false, message: error.message || "Error al actualizar status" });
    }
  }

  async createWithOrders(req: Request, res: Response) {
    try {
      const tripId = await this.createTripWithOrdersUseCase.execute(req.body);
      res.status(201).json({ success: true, message: "Viaje con órdenes creado correctamente", tripId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Error al crear viaje con órdenes" });
    }
  }
}
