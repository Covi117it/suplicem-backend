export interface Address {
  placeId: string;
  description: string;
  latitude: number;
  longitude: number;
  additionalInfo: string;
}

export interface User {
  uid: string;
  identificationType: "Cedula" | "Pasaporte";
  identification: string;
  identificationImage?: string;
  email: string;
  password?: string;
  names: string;
  lastNames: string;
  phone: string;
  userType: "client" | "driver" | "admin";
  addresses?: Address[] | null;
  vehicle?: {
    brand: string;
    model: string;
    year: string;
    tons: string;
    plateNumber: string;
  };
  createdAt: string;
  status: string; // 'pending' | 'active' | 'inactive' | 'rejected'
  aiRiskFlag?: boolean;
  aiRiskScore?: number;
  aiRiskReason?: string;
}
