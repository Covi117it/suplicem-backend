export function isValidDominicanCedula(cedula: string): boolean {
  const clean = (cedula || "").replace(/[^0-9]/g, "");
  return clean.length === 11;
}

export function isValidPassport(passport: string): boolean {
  const clean = (passport || "").trim();
  return /^[A-Z0-9]{6,12}$/i.test(clean);
}