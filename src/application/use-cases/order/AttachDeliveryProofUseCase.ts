import { OrderRepository } from "../../../domain/repositories/OrderRepository";

export interface AttachDeliveryProofDto {
  orderId: string;
  index: number;
  comment?: string;
  imageUrl?: string;
}

export class AttachDeliveryProofUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(dto: AttachDeliveryProofDto): Promise<void> {
    if (!dto.orderId) {
      throw new Error("ID de orden requerido");
    }
    if (isNaN(dto.index) || dto.index < 0) {
      throw new Error("Índice de entrega inválido");
    }

    await this.orderRepo.attachDeliveryProof(dto.orderId, dto.index, {
      comment: dto.comment,
      imageUrl: dto.imageUrl,
    });
  }
}
