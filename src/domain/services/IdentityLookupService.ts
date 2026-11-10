export interface IdentityLookupResult {
  cedula: string;
  names: string;
  lastNames: string;
  fullName?: string;
}

export interface IdentityLookupService {
  lookupCedula(cedula: string): Promise<IdentityLookupResult | null>;
}
