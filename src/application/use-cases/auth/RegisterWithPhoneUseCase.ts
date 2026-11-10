import { OtpError } from "../../../domain/errors/OtpError";
import { OtpRepository } from "../../../domain/repositories/OtpRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { normalizeDominicanPhone } from "../../../domain/services/PhoneService";
import { verifyOtpHash } from "../../../domain/services/OtpCryptoService";
import {
  isValidDominicanCedula,
  isValidPassport,
} from "../../../domain/services/IdentityVerificationService";
import { isValidRnc, normalizeTaxId } from "../../../domain/services/TaxIdService";
import { User } from "../../../domain/entities/User";

const MAX_ATTEMPTS = 5;

export interface RegisterWithPhoneDto {
  phone: string;
  code: string;
  email?: string;
  names: string;
  lastNames: string;
  identification: string;
  identificationType: "Cedula" | "Pasaporte";
  userType?: "client" | "driver" | "seller";
  personType?: "fisica" | "juridica";
  companyRnc?: string;
  companyName?: string;
  addresses?: User["addresses"];
  vehicle?: User["vehicle"];
}

export class RegisterWithPhoneUseCase {
  constructor(
    private otpRepo: OtpRepository,
    private userRepo: UserRepository,
    private authService: AuthService
  ) {}

  private buildUid(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return `phone_${digits}_${suffix}`;
  }

  async execute(data: RegisterWithPhoneDto) {
    const phone = normalizeDominicanPhone(data.phone);
    const challenge = await this.otpRepo.getByPhone(phone);

    if (!challenge) {
      throw new OtpError(
        "No hay un código activo para este número. Solicita uno nuevo.",
        400,
        "OTP_NOT_FOUND"
      );
    }

    if (challenge.purpose !== "register") {
      throw new OtpError(
        "Este código no pertenece a un registro por teléfono.",
        400,
        "OTP_PURPOSE_MISMATCH"
      );
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      await this.otpRepo.delete(phone);
      throw new OtpError(
        "El código ha expirado. Solicita uno nuevo.",
        400,
        "OTP_EXPIRED"
      );
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await this.otpRepo.delete(phone);
      throw new OtpError(
        "Demasiados intentos fallidos. Solicita un nuevo código.",
        429,
        "OTP_TOO_MANY_ATTEMPTS"
      );
    }

    if (!verifyOtpHash(phone, data.code, challenge.codeHash)) {
      await this.otpRepo.save({
        ...challenge,
        attempts: challenge.attempts + 1,
      });
      throw new OtpError(
        "El código ingresado es incorrecto.",
        400,
        "OTP_INVALID"
      );
    }

    await this.otpRepo.delete(phone);

    const existing = await this.userRepo.getByPhone(phone);
    if (existing) {
      throw new OtpError(
        "El número de teléfono ya está registrado. Inicia sesión con él.",
        409,
        "PHONE_ALREADY_REGISTERED"
      );
    }

    const names = (data.names || "").trim();
    const lastNames = (data.lastNames || "").trim();
    if (!names || !lastNames) {
      throw new OtpError("Los nombres y apellidos son obligatorios.", 400, "INVALID_NAME");
    }

    const identificationType = data.identificationType;
    const rawIdentification = (data.identification || "").trim();
    const identification =
      identificationType === "Cedula"
        ? rawIdentification.replace(/[^0-9]/g, "")
        : rawIdentification;

    if (identificationType === "Cedula") {
      if (!isValidDominicanCedula(identification)) {
        throw new OtpError(
          "El número de cédula dominicana ingresado no es válido.",
          400,
          "INVALID_IDENTIFICATION"
        );
      }
    } else if (!isValidPassport(identification)) {
      throw new OtpError(
        "El formato del pasaporte no es válido (debe tener entre 6 y 12 caracteres alfanuméricos).",
        400,
        "INVALID_IDENTIFICATION"
      );
    }

    const userType = data.userType || "client";
    const personType = data.personType || "fisica";
    const rawCompanyRnc = (data.companyRnc || "").trim();
    const companyRnc = rawCompanyRnc ? normalizeTaxId(rawCompanyRnc) : "";
    const companyName = (data.companyName || "").trim();

    const requiresCompany = personType === "juridica" || userType === "seller";
    if (requiresCompany) {
      if (!companyRnc || !isValidRnc(companyRnc)) {
        throw new OtpError(
          "El RNC de la empresa no es válido (debe tener 9 u 11 dígitos).",
          400,
          "INVALID_RNC"
        );
      }
      if (companyName.length < 2) {
        throw new OtpError(
          "La razón social de la empresa es obligatoria.",
          400,
          "INVALID_COMPANY_NAME"
        );
      }
    }

    const uid = this.buildUid(phone);
    const customToken = await this.authService.createCustomToken(uid, { phone });
    const tokens = await this.authService.exchangeCustomToken(customToken);

    const userToSave: User = {
      uid: tokens.uid || uid,
      identificationType,
      identification,
      email: (data.email || "").trim(),
      names,
      lastNames,
      phone,
      userType,
      personType,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    if (data.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
      userToSave.addresses = data.addresses;
    }
    if (data.vehicle) {
      userToSave.vehicle = data.vehicle;
    }
    if (requiresCompany) {
      userToSave.companyRnc = companyRnc;
      userToSave.companyName = companyName;
    }
    if (userType === "driver") {
      userToSave.driverCode = `COND-${userToSave.uid.slice(0, 5).toUpperCase()}`;
    }

    try {
      await this.userRepo.create(userToSave);
    } catch (error) {
      await this.authService.deleteUser(userToSave.uid);
      throw error;
    }

    return {
      success: true,
      ...tokens,
      emailVerified: false,
      user: userToSave,
    };
  }
}
