import { RncRecord } from "../../../domain/entities/RncRecord";
import { RncCacheRepository } from "../../../domain/repositories/RncCacheRepository";
import { RncLookupService } from "../../../domain/services/IdentityLookupService";
import { isValidRnc, normalizeTaxId } from "../../../domain/services/TaxIdService";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días en caché

export class VerifyRncUseCase {
  constructor(
    private lookupService: RncLookupService,
    private cacheRepo: RncCacheRepository
  ) {}

  async execute(rncInput: string): Promise<RncRecord & { cached: boolean }> {
    const rnc = normalizeTaxId(rncInput);

    if (!isValidRnc(rnc)) {
      const error: any = new Error(
        "El formato del RNC no es válido (debe tener 9 u 11 dígitos numéricos)."
      );
      error.statusCode = 400;
      throw error;
    }

    const cached = await this.cacheRepo.get(rnc);
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return { ...cached, cached: true };
    }

    const result = await this.lookupService.lookupRnc(rnc);
    if (!result) {
      const error: any = new Error(
        "No se encontraron datos para el RNC indicado en el padrón de la DGII."
      );
      error.statusCode = 404;
      throw error;
    }

    if (result.status && result.status !== "ACTIVO") {
      const error: any = new Error(
        `El contribuyente no se encuentra activo en la DGII (Estado actual: ${result.status}).`
      );
      error.statusCode = 400;
      throw error;
    }

    const now = Date.now();
    const record: RncRecord = {
      rnc,
      name: result.name,
      commercialName: result.commercialName,
      status: result.status,
      activity: result.activity,
      category: result.category,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
    };

    await this.cacheRepo.save(record);

    return { ...record, cached: false };
  }
}
