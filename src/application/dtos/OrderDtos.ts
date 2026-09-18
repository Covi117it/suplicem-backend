import { OrderItem } from "../../domain/entities/Order";
import { Address } from "../../domain/entities/User";

export interface CreateOrderDto {
  userId: string;
  deliveryType: "almacen" | "domicilio";
  deliveryAddress?: Address;
  deliveries?: {
    productId: string;
    address?: Address;
    quantity: number;
    unit: string;
  }[];
  items: {
    productId: string;
    quantity: number;
    name?: string;
    unit?: string;
    subtotal?: number;
  }[];
  paymentMethod?: "transfer" | "credit";  
  bankAccountId?: string;                 
  creditNote?: string;                    
  comments?: string;
  receiptImage?: string;
}
