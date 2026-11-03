import { CompanyRepository } from "../../../domain/repositories/CompanyRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { ApplicationActor } from "../../dtos/UserDtos";
import { isValidRnc, normalizeTaxId } from "../../../domain/services/TaxIdService";

export interface RegisterCompanyDto {
  rnc: string;
  name: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export class RegisterCompanyUseCase {
  constructor(
    private companyRepo: CompanyRepository,
    private userRepo: UserRepository
  ) {}

  async execute(data: RegisterCompanyDto, requester: ApplicationActor) {
    const rnc = normalizeTaxId(data?.rnc || "");

    if (!isValidRnc(rnc)) {
      const error: any = new Error("El RNC no es válido (debe tener 9 u 11 dígitos).");
      error.statusCode = 400;
      throw error;
    }

    const name = (data?.name || "").trim();
    if (name.length < 2) {
      const error: any = new Error("El nombre de la empresa es obligatorio.");
      error.statusCode = 400;
      throw error;
    }

    const existing = await this.companyRepo.getByRnc(rnc);
    if (existing) {
      const error: any = new Error("Ya existe una empresa registrada con ese RNC.");
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const company = {
      rnc,
      name,
      commercialName: data.commercialName?.trim() || name,
      ownerUid: requester.uid,
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      status: "pending" as const,
      createdAt: now,
    };

    const id = await this.companyRepo.create(company);

    await this.userRepo.update(requester.uid, {
      userType: "seller",
      companyRnc: rnc,
      companyName: name,
      status: "pending",
    });

    return { ...company, id };
  }
}
