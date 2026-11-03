export interface OtpChallenge {
  phone: string;
  uid: string;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  createdAt: string;
}
