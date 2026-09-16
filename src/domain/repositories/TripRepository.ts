import { Trip } from "../entities/Trip";

export interface TripRepository {
  create(trip: Trip): Promise<string>;
  getAvailable(): Promise<Trip[]>;
  getById(tripId: string): Promise<Trip | null>;
  getAll(): Promise<Trip[]>;
  getDriverTripHistory(userId: string): Promise<Trip[]>;
  getDriverActualTrips(userId: string): Promise<Trip[]>;
  assignDriver(tripId: string, driverId: string): Promise<void>;
  updateTripStatus(tripId: string, status: string): Promise<void>;
  completeTrip(tripId: string): Promise<void>;
  getByIdWithOrders(tripId: string): Promise<Trip & { orders: any[] }>;
  getTripByOrderId(orderId: string): Promise<{
    id: string;
    tripNumber: string;
    status: string;
    assignedDriverId: string;
    driver: any | null;
  } | null>;
  createWithOrders(data: any): Promise<string>;
}
