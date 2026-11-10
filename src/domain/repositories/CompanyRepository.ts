import { Company } from "../entities/Company";

export interface CompanyRepository {
  create(company: Company): Promise<string>;
  getById(id: string): Promise<Company | null>;
  getByRnc(rnc: string): Promise<Company | null>;
  update(id: string, data: Partial<Company>): Promise<void>;
}
