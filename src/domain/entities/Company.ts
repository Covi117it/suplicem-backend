export interface Company {
  id?: string;
  rnc: string;
  name: string;
  commercialName?: string;
  ownerUid?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: "pending" | "active" | "rejected";
  createdAt: string;
}
