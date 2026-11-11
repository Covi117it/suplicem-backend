export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
  sendMessage(phone: string, body: string): Promise<void>;
}
