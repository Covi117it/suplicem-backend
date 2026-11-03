export class InvalidPhoneError extends Error {
  statusCode = 400;
  constructor(message = "Número de teléfono dominicano inválido") {
    super(message);
    this.name = "InvalidPhoneError";
  }
}

/**
 * Normaliza teléfonos dominicanos a formato E.164 (+1XXXXXXXXXX).
 * Acepta 8091234567, 18091234567, +18091234567 o con separadores.
 */
export function normalizeDominicanPhone(phone: string): string {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    if (!/^(809|829|849)\d{7}$/.test(clean)) {
      throw new InvalidPhoneError();
    }
    return `+1${clean}`;
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    const local = clean.slice(1);
    if (!/^(809|829|849)\d{7}$/.test(local)) {
      throw new InvalidPhoneError();
    }
    return `+${clean}`;
  }
  throw new InvalidPhoneError();
}
