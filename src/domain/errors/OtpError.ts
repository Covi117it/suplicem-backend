export class OtpError extends Error {
  constructor(message: string, public statusCode = 400, public code?: string) {
    super(message);
    this.name = "OtpError";
  }
}
