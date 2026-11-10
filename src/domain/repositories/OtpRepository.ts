import { OtpChallenge } from "../entities/OtpChallenge";

export interface OtpRepository {
  save(challenge: OtpChallenge): Promise<void>;
  getByPhone(phone: string): Promise<OtpChallenge | null>;
  delete(phone: string): Promise<void>;
}
