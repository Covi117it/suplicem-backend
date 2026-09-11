import { OrderItem } from "../../domain/entities/Order";
import { Address } from "../../domain/entities/User";

export interface CreateOrderDto {
  userId: string;
  deliveryType: "almacen" | "domicilio";
  deliveries: {
    productId: string;
    address?: Address;
    quantity: number;
    unit: string;
  }[];
  items: OrderItem[];
  comments?: string;
  receiptImage?: string;
}
