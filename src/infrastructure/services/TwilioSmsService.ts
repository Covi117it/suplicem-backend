import axios from "axios";
import { SmsService } from "../../domain/services/SmsService";

/**
 * Envía mensajes SMS usando la API REST de Twilio.
 * Si no hay credenciales configuradas, registra el mensaje en consola
 * únicamente fuera de producción para permitir pruebas locales.
 */
export class TwilioSmsService implements SmsService {
  async sendOtp(phone: string, code: string): Promise<void> {
    const body = `Suplicem: tu código de verificación es ${code}. Vence en 5 minutos.`;
    await this.sendMessage(phone, body);
  }

  async sendMessage(phone: string, body: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";
    const from = process.env.TWILIO_SMS_FROM || "";

    if (!accountSid || !authToken || !from) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("El servicio de SMS no está configurado.");
      }
      console.info(`[SMS] Mensaje para ${phone}: ${body}`);
      return;
    }

    try {
      const sid = await this.postMessage(accountSid, authToken, from, phone, body);
      console.info(`[SMS] Enviado (SID: ${sid || "N/D"})`);
    } catch (error: any) {
      const twilioError = error?.response?.data;

      // Las cuentas trial solo permiten plantillas predefinidas (error 572006).
      if (twilioError?.code === 572006) {
        const template = this.trialTemplateFor(body);
        console.info(`[SMS] Cuenta trial: reintentando con plantilla ${template}`);
        try {
          const sid = await this.postMessage(accountSid, authToken, from, phone, template);
          console.info(`[SMS] Enviado (trial ${template}, SID: ${sid || "N/D"})`);
          return;
        } catch (retryError: any) {
          throw this.toTwilioError(retryError);
        }
      }

      throw this.toTwilioError(error);
    }
  }

  private async postMessage(
    accountSid: string,
    authToken: string,
    from: string,
    to: string,
    body: string
  ): Promise<string | undefined> {
    const response = await axios.post<{ sid?: string }>(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      }),
      {
        auth: { username: accountSid, password: authToken },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      }
    );

    return response.data?.sid;
  }

  private trialTemplateFor(body: string): string {
    return /c[oó]digo de verificaci[oó]n/i.test(body) ? "sms_2fa" : "sms_account_alerts";
  }

  private toTwilioError(error: any): Error {
    const twilioError = error?.response?.data;
    const detail = twilioError?.message
      ? `${twilioError.code ? `[${twilioError.code}] ` : ""}${twilioError.message}`
      : error?.message || "Error desconocido";
    return new Error(`Twilio SMS: ${detail}`);
  }
}
