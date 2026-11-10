import { OtpError } from "../../../domain/errors/OtpError";
import { OtpRepository } from "../../../domain/repositories/OtpRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { normalizeDominicanPhone } from "../../../domain/services/PhoneService";
import { generateOtpCode, hashOtp } from "../../../domain/services/OtpCryptoService";
import { SmsService } from "../../../domain/services/SmsService";

const OTP_TTL_MS = 5 * 60 * 1000;

export class RequestOtpUseCase {
  constructor(
    private userRepo: UserRepository,
    private otpRepo: OtpRepository,
    private smsService: SmsService
  ) {}

  async execute(phoneInput: string) {
    const phone = normalizeDominicanPhone(phoneInput);
    const user = await this.userRepo.getByPhone(phone);

    if (!user) {
      throw new OtpError(
        "El número de teléfono no está registrado en Suplicem.",
        404,
        "PHONE_NOT_FOUND"
      );
    }

    if (user.status === "inactive" || user.status === "banned") {
      throw new OtpError(
        "Tu cuenta se encuentra inactiva o suspendida. Comunícate con soporte.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    const code = generateOtpCode();
    const now = Date.now();

    await this.otpRepo.save({
      phone,
      uid: user.uid,
      codeHash: hashOtp(phone, code),
      attempts: 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    });

    await this.smsService.sendOtp(phone, code);

    return {
      success: true,
      phone,
      expiresInSeconds: OTP_TTL_MS / 1000,
    };
  }
}
