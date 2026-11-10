import { createHmac, randomInt, timingSafeEqual } from "crypto";

const getSecret = () =>
  process.env.OTP_HASH_SECRET || "suplicem-otp-development-secret";

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", getSecret())
    .update(`${phone}:${code}`)
    .digest("hex");
}

export function verifyOtpHash(
  phone: string,
  code: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(hashOtp(phone, code));
  const expected = Buffer.from(expectedHash || "");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
