export interface Trip {
  id?: string;
  tripNumber: string;
  orderIds: string[];
  comments?: string;
  totalTons: number;
  status: "available" | "assigned" | "accepted" | "in_progress" | "completed" | "canceled" | "started" | string;
  assignedDriverId?: string;
  createdAt: string;
  driver?: any;
  cancellationReason?: string;
  deliveryPin?: string;
}