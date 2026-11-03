import { OtpError } from "../../../domain/errors/OtpError";
import { OtpRepository } from "../../../domain/repositories/OtpRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { normalizeDominicanPhone } from "../../../domain/services/PhoneService";
import { verifyOtpHash } from "../../../domain/services/OtpCryptoService";

const MAX_ATTEMPTS = 5;

export class VerifyOtpUseCase {
  constructor(
    private otpRepo: OtpRepository,
    private userRepo: UserRepository,
    private authService: AuthService
  ) {}

  async execute(phoneInput: string, code: string) {
    const phone = normalizeDominicanPhone(phoneInput);
    const challenge = await this.otpRepo.getByPhone(phone);

    if (!challenge) {
      throw new OtpError(
        "No hay un código activo para este número. Solicita uno nuevo.",
        400,
        "OTP_NOT_FOUND"
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

    if (!verifyOtpHash(phone, code, challenge.codeHash)) {
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

    const user = await this.userRepo.getById(challenge.uid);
    if (!user) {
      throw new OtpError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    }

    if (user.status === "inactive" || user.status === "banned") {
      throw new OtpError(
        "Tu cuenta se encuentra inactiva o suspendida. Comunícate con soporte.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    const customToken = await this.authService.createCustomToken(user.uid, {
      phone,
    });
    const tokens = await this.authService.exchangeCustomToken(customToken);

    return {
      success: true,
      ...tokens,
      emailVerified: true,
      user,
    };
  }
}
