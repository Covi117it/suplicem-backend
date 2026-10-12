import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { LocationRepository } from "../../../domain/repositories/LocationRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export interface TripTrackingItemDto {
  id: string;
  tripNumber: string;
  status: string;
  totalTons: number;
  assignedDriverId?: string;
  driver: {
    id?: string;
    names?: string;
    lastNames?: string;
    phone?: string;
    vehicle?: any;
  } | null;
  deliveryPin?: string;
  location: {
    latitude: number;
    longitude: number;
    updatedAt?: string;
  } | null;
  createdAt?: string;
}

export interface OrderTrackingDto {
  orderId: string;
  orderNumber: number;
  orderStatus: string;
  totalTons: number;
  deliveredTons: number;
  pendingBalance: number;
  trips: TripTrackingItemDto[];
  trip: TripTrackingItemDto | null;
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
    private locationRepo: LocationRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(
    orderId: string,
    userId?: string,
    userRole?: string
  ): Promise<OrderTrackingDto | null> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) {
      return null;
    }

    if (userRole === "client" && order.userId !== userId) {
      throw new Error("No tienes permiso para ver el tracking de esta orden.");
    }

    // 1. Obtener todos los viajes asociados a la orden
    let rawTrips: any[] = [];
    if (this.tripRepo.getTripsByOrderId) {
      rawTrips = await this.tripRepo.getTripsByOrderId(orderId);
    }
    if (rawTrips.length === 0) {
      const single = await this.tripRepo.getTripByOrderId(orderId);
      if (single && single.status !== "canceled") {
        rawTrips = [single];
      }
    }

    // Si el usuario es chofer, verificar que esté asignado a al menos uno de los viajes
    if (userRole === "driver") {
      const isAssigned = rawTrips.some((t) => {
        const dId = t.assignedDriverId || t.driverId || t.driver?.id || t.driver?.uid;
        return dId === userId;
      });
      if (!isAssigned) {
        throw new Error("No tienes permiso para ver el tracking de esta orden porque no eres el chofer asignado.");
      }
    }

    // 2. Procesar cada viaje (datos de chofer, ubicación GPS y PIN de seguridad)
    const mappedTrips: TripTrackingItemDto[] = [];

    for (const t of rawTrips) {
      const driverId = t.assignedDriverId || t.driverId || t.driver?.id || t.driver?.uid;
      let driverData = t.driver || null;

      if (!driverData && driverId && this.userRepo) {
        try {
          const userDoc = await this.userRepo.getById(driverId);
          if (userDoc) {
            driverData = {
              id: userDoc.uid,
              names: userDoc.names,
              lastNames: userDoc.lastNames,
              phone: userDoc.phone,
              vehicle: userDoc.vehicle,
            };
          }
        } catch {
          // Ignorar error al cargar usuario secundario
        }
      }

      let locationData: { latitude: number; longitude: number; updatedAt?: string } | null = null;
      if (driverId && (t.status === "accepted" || t.status === "started" || t.status === "in_progress")) {
        const loc = await this.locationRepo.get(driverId);
        if (loc) {
          locationData = {
            latitude: loc.lat,
            longitude: loc.lng,
            updatedAt: loc.updatedAt,
          };
        }
      }

      // Asegurar que cada viaje cuente con PIN único
      let tripPin = t.deliveryPin;
      if (!tripPin) {
        tripPin = Math.floor(1000 + Math.random() * 9000).toString();
        t.deliveryPin = tripPin;
        if (t.id) {
          import("../../../config/firebase").then(({ firestore }) => {
            firestore.collection("trips").doc(t.id).update({ deliveryPin: tripPin }).catch(() => {});
          }).catch(() => {});
        }
      }

      const showPin = (userRole === "admin" || order.userId === userId) && t.status !== "completed";

      mappedTrips.push({
        id: t.id || "",
        tripNumber: t.tripNumber,
        status: t.status,
        totalTons: Number(t.totalTons) || 0,
        assignedDriverId: driverId,
        driver: driverData,
        deliveryPin: showPin ? tripPin : undefined,
        location: locationData,
        createdAt: t.createdAt,
      });
    }

    // Identificar el viaje principal activo para compatibilidad hacia atrás
    const activeTrip =
      mappedTrips.find((t) => ["started", "in_progress"].includes(t.status)) ||
      mappedTrips.find((t) => t.status === "accepted") ||
      mappedTrips.find((t) => t.status === "assigned") ||
      mappedTrips.find((t) => t.status === "available") ||
      mappedTrips[0] ||
      null;

    return {
      orderId: order.id || orderId,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      totalTons: Number(order.totalTons) || 0,
      deliveredTons: Number(order.deliveredTons) || 0,
      pendingBalance: Number(order.pendingBalance) || 0,
      trips: mappedTrips,
      trip: activeTrip,
      driver: activeTrip?.driver || null,
      location: activeTrip?.location || null,
    };
  }
}