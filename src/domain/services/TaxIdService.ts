/**
 * Validación compartida de identificaciones fiscales dominicanas.
 * Se usa tanto en registro de usuarios (cédula) como en registro de empresas (RNC).
 */

export function normalizeTaxId(value: string): string {
  return (value || "").replace(/[^0-9]/g, "");
}

export function isValidDominicanCedula(cedula: string): boolean {
  const clean = normalizeTaxId(cedula);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  return true;
}

export function isValidRnc(rnc: string): boolean {
  const clean = normalizeTaxId(rnc);
  // El RNC de empresas dominicanas tiene 9 dígitos; se aceptan 11
  // únicamente cuando corresponde al registro de una persona física.
  if (clean.length !== 9 && clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  return true;
}

export function formatRnc(rnc: string): string {
  const clean = normalizeTaxId(rnc);
  if (clean.length !== 9) return clean;
  return `${clean.slice(0, 1)}-${clean.slice(1, 3)}-${clean.slice(3, 8)}-${clean.slice(8)}`;
}
