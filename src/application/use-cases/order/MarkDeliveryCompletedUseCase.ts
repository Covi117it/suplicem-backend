import { OrderRepository } from "../../../domain/repositories/OrderRepository";

export interface CompleteDeliveryDto {
  orderId: string;
  index: number;
  comment?: string;
  imageUrl?: string;
}

export class MarkDeliveryCompletedUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(
    orderIdOrDto: string | CompleteDeliveryDto,
    index?: number
  ): Promise<void> {
    if (typeof orderIdOrDto === "object") {
      await this.orderRepo.completeDelivery(
        orderIdOrDto.orderId,
        orderIdOrDto.index,
        {
          comment: orderIdOrDto.comment,
          imageUrl: orderIdOrDto.imageUrl,
        }
      );
    } else if (typeof index === "number") {
      await this.orderRepo.completeDelivery(orderIdOrDto, index, {});
    }
  }
}