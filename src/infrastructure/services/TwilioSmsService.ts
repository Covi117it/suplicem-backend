import axios from "axios";
import { SmsService } from "../../domain/services/SmsService";

/**
 * Envía códigos OTP por SMS usando la API REST de Twilio.
 * Si no hay credenciales configuradas, registra el código en consola
 * únicamente fuera de producción para permitir pruebas locales.
 */
export class TwilioSmsService implements SmsService {
  async sendOtp(phone: string, code: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";
    const from = process.env.TWILIO_SMS_FROM || "";

    if (!accountSid || !authToken || !from) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("El servicio de SMS no está configurado.");
      }
      console.info(`[OTP] Código para ${phone}: ${code}`);
      return;
    }

    const body = `Suplicem: tu código de verificación es ${code}. Vence en 5 minutos.`;

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: phone,
        From: from,
        Body: body,
      }),
      {
        auth: { username: accountSid, password: authToken },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
  }
}
