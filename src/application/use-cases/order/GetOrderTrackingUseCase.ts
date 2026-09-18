import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { LocationRepository } from "../../../domain/repositories/LocationRepository";

export interface OrderTrackingDto {
  orderId: string;
  orderNumber: number;
  orderStatus: string;
  trip: {
    id: string;
    tripNumber: string;
    status: string;
    assignedDriverId?: string;
    driver?: any;
  } | null;
  driver: {
    id?: string;
    names?: string;
    lastNames?: string;
    phone?: string;
    vehicle?: any;
  } | null;
  location: {
    latitude: number;
    longitude: number;
    updatedAt?: string;
  } | null;
}

export class GetOrderTrackingUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo: TripRepository,
    private locationRepo: LocationRepository
  ) {}

  async execute(orderId: string): Promise<OrderTrackingDto | null> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) {
      return null;
    }

    const trip = await this.tripRepo.getTripByOrderId(orderId);

    let driverData: any = null;
    let locationData: { latitude: number; longitude: number; updatedAt?: string } | null = null;

    if (trip && trip.assignedDriverId) {
      driverData = trip.driver || null;

      // Si el viaje está en curso o aceptado, obtenemos el GPS del conductor
      if (trip.status === "accepted" || trip.status === "started") {
        const loc = await this.locationRepo.get(trip.assignedDriverId);
        if (loc) {
          locationData = {
            latitude: loc.lat,
            longitude: loc.lng,
            updatedAt: loc.updatedAt,
          };
        }
      }
    }

    return {
      orderId: order.id || orderId,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      trip: trip
        ? {
            id: trip.id || "",
            tripNumber: trip.tripNumber,
            status: trip.status,
            assignedDriverId: trip.assignedDriverId || (driverData?.id ?? ""),
            driver: driverData,
          }
        : null,
      driver: driverData
        ? {
            id: driverData.id,
            names: driverData.names,
            lastNames: driverData.lastNames,
            phone: driverData.phone,
            vehicle: driverData.vehicle,
          }
        : null,
      location: locationData,
    };
  }
}