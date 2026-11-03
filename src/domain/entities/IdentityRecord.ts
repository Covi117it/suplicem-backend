export interface IdentityRecord {
  cedula: string;
  names: string;
  lastNames: string;
  fullName?: string;
  fetchedAt: string;
  expiresAt: string;
}
