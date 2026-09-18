import { Request, Response } from "express";
import { LocationFirestoreRepository } from "../../../infrastructure/firestore/LocationFirestoreRepository";
import { UpdateLocationUseCase } from "../../../application/use-cases/location/UpdateLocationUseCase";
import { GetLocationUseCase } from "../../../application/use-cases/location/GetLocationUseCase";

const repo = new LocationFirestoreRepository();
const updateLocation = new UpdateLocationUseCase(repo);
const getLocation = new GetLocationUseCase(repo);

export class LocationController {
  async update(req: Request, res: Response) {
    const { lat, lng } = req.body;
    const driverId = req.user?.uid;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "Lat y lng son requeridos" });
    }

    await updateLocation.execute(`${driverId}`, lat, lng);

    res.status(200).json({ success: true, message: "Ubicación actualizada" });
  }

  async get(req: Request, res: Response) {
    const { driverId } = req.params;
    const data = await getLocation.execute(driverId);

    if (!data) {
      return res.status(200).json({ success: true, location: null, message: "Ubicación no disponible" });
    }

    res.status(200).json({ success: true, location: data });
  }
}
