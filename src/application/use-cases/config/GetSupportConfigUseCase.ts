import { SupportConfig } from "../../../domain/entities/SupportConfig";
import { SupportConfigRepository } from "../../../domain/repositories/SupportConfigRepository";

export class GetSupportConfigUseCase {
  constructor(private supportConfigRepo: SupportConfigRepository) {}

  async execute(): Promise<SupportConfig> {
    return this.supportConfigRepo.get();
  }
}
