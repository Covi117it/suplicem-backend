import { Request, Response } from "express";
import { LocationFirestoreRepository } from "../../../infrastructure/firestore/LocationFirestoreRepository";
import { UpdateLocationUseCase } from "../../../application/use-cases/location/UpdateLocationUseCase";
import { GetLocationUseCase } from "../../../application/use-cases/location/GetLocationUseCase";

const repo = new LocationFirestoreRepository();

export class LocationController {
  constructor(
    private updateLocationUseCase = new UpdateLocationUseCase(repo),
    private getLocationUseCase = new GetLocationUseCase(repo)
  ) {}

  async update(req: Request, res: Response) {
    const { lat, lng } = req.body;
    const driverId = req.user?.uid;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "Lat y lng son requeridos" });
    }

    await this.updateLocationUseCase.execute(`${driverId}`, lat, lng);
    res.status(200).json({ success: true, message: "Ubicación actualizada" });
  }

  async get(req: Request, res: Response) {
    const { driverId } = req.params;
    const authUser = (req as any).user;

    // Prevención de BOLA/IDOR: Solo el propio conductor o un admin pueden consultar su GPS en vivo
    if (authUser?.userType !== "admin" && authUser?.uid !== driverId) {
      return res.status(403).json({
        success: false,
        message: "No tienes permiso para consultar la ubicación de este conductor",
      });
    }

    const data = await this.getLocationUseCase.execute(driverId);

    if (!data) {
      return res.status(200).json({ success: true, location: null, message: "Ubicación no disponible" });
    }

    res.status(200).json({ success: true, location: data });
  }
}
