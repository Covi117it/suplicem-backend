import { Address } from "./User";

export interface DeliveryDetail {
  productId: string;
  address?: Address;
  quantity: number;
  unit: string;
  status?: "pending" | "delivered";
  images?: string[];
  comment?: string;
  productName?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  orderNumber: number;
  id?: string;
  userId: string;
  deliveryType: "almacen" | "domicilio";
  deliveries: DeliveryDetail[];
  items: OrderItem[];
  paymentMethod?: "transfer" | "credit"; 
  bankAccountId?: string; 
  creditNote?: string;
  comments?: string;
  receiptImage?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
  tripId?: string;
  aiRiskFlag?: boolean;
  aiRiskScore?: number;
  aiRiskReason?: string;
}
