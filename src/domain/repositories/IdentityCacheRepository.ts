import { IdentityRecord } from "../entities/IdentityRecord";

export interface IdentityCacheRepository {
  get(cedula: string): Promise<IdentityRecord | null>;
  save(record: IdentityRecord): Promise<void>;
}
