export interface IdentityLookupResult {
  cedula: string;
  names: string;
  lastNames: string;
  fullName?: string;
}

export interface IdentityLookupService {
  lookupCedula(cedula: string): Promise<IdentityLookupResult | null>;
}

export interface RncLookupResult {
  rnc: string;
  name: string;
  commercialName?: string;
  status: string;
  activity?: string;
  category?: string;
}

export interface RncLookupService {
  lookupRnc(rnc: string): Promise<RncLookupResult | null>;
}
