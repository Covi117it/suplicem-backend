export function isValidDominicanCedula(cedula: string): boolean {
  const clean = (cedula || "").replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(clean)) {
    return false;
  }

  const digits = clean.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    const factor = i % 2 === 0 ? 1 : 2;
    let temp = digits[i] * factor;
    if (temp > 9) {
      temp -= 9;
    }
    sum += temp;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[10];
}

export function isValidPassport(passport: string): boolean {
  const clean = (passport || "").trim();
  return /^[A-Z0-9]{6,12}$/i.test(clean);
}