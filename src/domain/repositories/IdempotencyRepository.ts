export interface IdempotencyRecord {
  key: string;
  userId: string;
  orderId: string;
  orderNumber: number;
  createdAt: string;
  status: "processing" | "completed";
}

export interface IdempotencyRepository {
  find(key: string, userId: string): Promise<IdempotencyRecord | null>;
  reserve(key: string, userId: string): Promise<{ reserved: boolean; existingRecord?: IdempotencyRecord }>;
  complete(key: string, userId: string, response: { orderId: string; orderNumber: number }): Promise<void>;
}