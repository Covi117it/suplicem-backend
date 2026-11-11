import { SupportConfig } from "../../../domain/entities/SupportConfig";
import { SupportConfigRepository } from "../../../domain/repositories/SupportConfigRepository";

export class UpdateSupportConfigUseCase {
  constructor(private supportConfigRepo: SupportConfigRepository) {}

  async execute(data: SupportConfig, adminUid: string): Promise<void> {
    const configToSave: SupportConfig = {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    };
    await this.supportConfigRepo.update(configToSave);
  }
}
