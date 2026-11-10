export interface Product {
  id?: string;
  name: string;
  unit: string;
  price: number;
  lotSize?: number;
  lotPrice?: number;
  lotPrices?: Record<string, number>;
  manualLotPrices?: Record<string, number>;
  imageUrl: string;
  createdAt: string;
  weightKg?: number;
}
