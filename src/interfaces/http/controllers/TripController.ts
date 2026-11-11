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
import { AssignTripDriverUseCase } from "../../../application/use-cases/trip/AssignTripDriverUseCase";
import { SplitOrderTripsUseCase } from "../../../application/use-cases/trip/SplitOrderTripsUseCase";
import { SplitSingleTripUseCase } from "../../../application/use-cases/trip/SplitSingleTripUseCase";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";
import { NotificationFirestoreRepository } from "../../../infrastructure/firestore/NotificationFirestoreRepository";
import { NotificationDispatcherService } from "../../../application/services/NotificationDispatcherService";

const tripRepo = new TripFirestoreRepository();
const orderRepo = new OrderFirestoreRepository();
const userRepo = new UserFirestoreRepository();
const notificationRepo = new NotificationFirestoreRepository();
const notificationDispatcher = new NotificationDispatcherService(notificationRepo);

export class TripController {
  constructor(
    private createTripUseCase = new CreateTripUseCase(tripRepo, orderRepo, userRepo),
    private getAvailableTripsUseCase = new GetAvailableTripsUseCase(tripRepo, userRepo),
    private getDriverTripHistoryUseCase = new GetDriverTripHistoryUseCase(tripRepo),
    private getDriverActualTripsUseCase = new GetDriverActualTripsUseCase(tripRepo),
    private getAllTripsUseCase = new GetAllTripsUseCase(tripRepo, orderRepo),
    private acceptTripUseCase = new AcceptTripUseCase(tripRepo, userRepo),
    private getTripDetailsUseCase = new GetTripDetailsUseCase(tripRepo),
    private getTripByOrderIdUseCase = new GetTripByOrderIdUseCase(tripRepo),
    private updateTripStatusUseCase = new UpdateTripStatusUseCase(tripRepo),
    private completeTripUseCase = new CompleteTripUseCase(tripRepo, orderRepo, userRepo, notificationDispatcher),
    private getTripByIdUseCase = new GetTripByIdUseCase(tripRepo),
    private getDriverActiveTripUseCase = new GetDriverActiveTripUseCase(tripRepo),
    private assignTripDriverUseCase = new AssignTripDriverUseCase(tripRepo, userRepo),
    private splitOrderTripsUseCase = new SplitOrderTripsUseCase(tripRepo, orderRepo, userRepo),
    private splitSingleTripUseCase = new SplitSingleTripUseCase(tripRepo, orderRepo, userRepo)
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

  async getAll(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      const q = (req as any).validatedQuery || req.query;
      const { status, search, page, limit } = q;
      const isPaginatedRequest =
        page !== undefined ||
        limit !== undefined ||
        (typeof search === "string" && search.trim() !== "") ||
        (typeof status === "string" && status.trim() !== "");

      if (isPaginatedRequest) {
        const result = await this.getAllTripsUseCase.executePaginated({
          actorUid: authUser?.uid,
          actorUserType: authUser?.userType,
          status: typeof status === "string" ? status : undefined,
          search: typeof search === "string" ? search : undefined,
          page: page !== undefined ? Number(page) : undefined,
          limit: limit !== undefined ? Number(limit) : undefined,
        });
        return res.status(200).json({ success: true, ...result });
      }

      const trips = await this.getAllTripsUseCase.execute(
        authUser?.uid ? { uid: authUser.uid, userType: authUser.userType } : undefined
      );

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
      const authUser = (req as any).user;
      const trip = await this.getTripDetailsUseCase.execute(req.params.id, authUser);
      if (!trip) {
        return res.status(404).json({ success: false, message: "Viaje no encontrado" });
      }
      res.status(200).json({ success: true, trip });
    } catch (error: any) {
      const status = error.message?.includes("permiso") ? 403 : 404;
      res.status(status).json({ success: false, message: error.message || "Error al obtener el viaje" });
    }
  }

  async getTripByOrderId(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      const orderId = req.params.id;
      const result = await this.getTripByOrderIdUseCase.execute(orderId);

      if (!result.trip && result.trips.length === 0) {
        return res.status(404).json({ success: false, message: "Viajes no encontrados" });
      }
      if (authUser?.userType === "driver" && result.trip && result.trip.assignedDriverId !== authUser.uid) {
        return res.status(403).json({ success: false, message: "No tienes permiso para ver este viaje" });
      }

      res.status(200).json({
        success: true,
        trip: result.trip,
        trips: result.trips,
      });
    } catch (error: any) {
      const status = error.message?.includes("permiso") ? 403 : 404;
      res.status(status).json({ success: false, message: error.message || "Error al obtener el viaje" });
    }
  }

    async getDriverActiveTrip(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) return res.status(401).json({ success: false, message: "Usuario no autenticado" });

      const trip = await this.getDriverActiveTripUseCase.execute(userId);
      if (trip && trip.deliveryPin) {
        // Cero Fugas de Datos: jamás enviar el PIN al chofer
        delete (trip as any).deliveryPin;
      }
      res.status(200).json({ success: true, hasActiveTrip: Boolean(trip), trip });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Error al obtener viaje activo" });
    }
  }

  async updateTripStatus(req: Request, res: Response) {
    try {
      const tripId = req.params.id || req.body.tripId;
      const { status, targetStatus, reason, cancellationReason, deliveryPin } = req.body;
      const finalStatus = targetStatus || status;
      const finalReason = cancellationReason || reason;
      if (!tripId || !finalStatus) return res.status(400).json({ success: false, message: "tripId y status son requeridos" });
      const authUser = (req as any).user;
      const userId = authUser?.uid;
      const userRole = authUser?.userType;
      if (finalStatus === "completed") {
        await this.completeTripUseCase.execute(tripId, userId, userRole, deliveryPin);
      } else {
        await this.updateTripStatusUseCase.execute(tripId, finalStatus, userId, userRole, finalReason, deliveryPin);
      }
      res.status(200).json({ success: true, message: `Status actualizado correctamente a ${finalStatus}` });
    } catch (error: any) {
      const status = error.message?.includes("permiso") ? 403 : error.message?.includes("encontrado") ? 404 : 400;
      res.status(status).json({ success: false, message: error.message || "Error al actualizar status" });
    }
  }

  async assignDriver(req: Request, res: Response) {
    try {
      const tripId = req.params.id;
      const { driverId } = req.body;
      await this.assignTripDriverUseCase.execute(tripId, driverId);
      res.status(200).json({ success: true, message: "Conductor asignado al viaje correctamente" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Error al asignar conductor al viaje" });
    }
  }

  async splitOrderTrips(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId || req.params.id;
      const { trips } = req.body;
      const createdTripIds = await this.splitOrderTripsUseCase.execute(orderId, trips);
      res.status(200).json({
        success: true,
        message: "Viajes fraccionados y planificados correctamente",
        tripIds: createdTripIds,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al planificar los viajes de la orden",
      });
    }
  }

  async splitSingleTrip(req: Request, res: Response) {
    try {
      const tripId = req.params.id;
      const { trips } = req.body;
      const createdTripIds = await this.splitSingleTripUseCase.execute(tripId, trips);
      res.status(200).json({
        success: true,
        message: "Viaje fraccionado correctamente",
        tripIds: createdTripIds,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Error al fraccionar el viaje",
      });
    }
  }
}

