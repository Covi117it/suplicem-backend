export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}
