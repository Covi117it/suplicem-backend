import { SupportConfig } from "../../../domain/entities/SupportConfig";
import { SupportConfigRepository } from "../../../domain/repositories/SupportConfigRepository";

export class GetSupportConfigUseCase {
  constructor(private supportConfigRepo: SupportConfigRepository) {}

  async execute(): Promise<Omit<SupportConfig, "updatedBy">> {
    const config = await this.supportConfigRepo.get();
    const { updatedBy: _updatedBy, ...publicConfig } = config;
    return publicConfig;
  }
}
