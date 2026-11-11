import { SupportConfig } from "../entities/SupportConfig";

export interface SupportConfigRepository {
  get(): Promise<SupportConfig>;
  update(data: SupportConfig): Promise<void>;
}
