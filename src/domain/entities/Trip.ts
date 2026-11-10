import { Address } from "./User";

export interface Trip {
  id?: string;
  tripNumber: string;
  orderIds: string[];
  comments?: string;
  totalTons: number;
  status: "available" | "assigned" | "accepted" | "in_progress" | "completed" | "canceled" | "started" | string;
  assignedDriverId?: string;
  driverId?: string;
  createdAt: string;
  assignedAt?: string;
  acceptedAt?: string;
  driver?: any;
  cancellationReason?: string;
  deliveryPin?: string;
  deliveryId?: string;
  destinationAddress?: Address;
}