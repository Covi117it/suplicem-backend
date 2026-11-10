import { RncRecord } from "../entities/RncRecord";

export interface RncCacheRepository {
  get(rnc: string): Promise<RncRecord | null>;
  save(record: RncRecord): Promise<void>;
}
