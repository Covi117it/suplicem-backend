import { IdentityCacheRepository } from "../../../domain/repositories/IdentityCacheRepository";
import { IdentityLookupService } from "../../../domain/services/IdentityLookupService";
import { isValidDominicanCedula, normalizeTaxId } from "../../../domain/services/TaxIdService";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class VerifyCedulaUseCase {
  constructor(
    private lookupService: IdentityLookupService,
    private cacheRepo: IdentityCacheRepository
  ) {}

  async execute(cedulaInput: string) {
    const cedula = normalizeTaxId(cedulaInput);

    if (!isValidDominicanCedula(cedula)) {
      const error: any = new Error("El número de cédula dominicana no es válido.");
      error.statusCode = 400;
      throw error;
    }

    const cached = await this.cacheRepo.get(cedula);
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return { ...cached, cached: true };
    }

    const result = await this.lookupService.lookupCedula(cedula);
    if (!result) {
      const error: any = new Error("No se encontraron datos para la cédula indicada.");
      error.statusCode = 404;
      throw error;
    }

    const now = Date.now();
    const record = {
      cedula,
      names: result.names,
      lastNames: result.lastNames,
      fullName: result.fullName,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
    };

    await this.cacheRepo.save(record);

    return { ...record, cached: false };
  }
}
