import { isValidDominicanCedula as validateCedula } from "./TaxIdService";

export function isValidDominicanCedula(cedula: string): boolean {
  return validateCedula(cedula);
}

export function isValidPassport(passport: string): boolean {
  const clean = (passport || "").trim();
  return /^[A-Z0-9]{6,12}$/i.test(clean);
}